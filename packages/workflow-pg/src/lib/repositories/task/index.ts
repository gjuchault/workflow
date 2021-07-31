import type {
  AssignedTask,
  DelayedTask,
  ProcessingTask,
  Storage,
  Task,
  WaitingTask,
} from '@workflow/core';
import { sql } from 'slonik';
import { v4 as uuidv4 } from 'uuid';

import { keyByWith } from '../../helpers/keyBy';
import { JsonPrimitive, prepareBulkInsert } from '../../helpers/slonik';
import { Repository } from '../repository';

import { DatabaseTask, encodeTask } from './codec';
import {
  ensureAssignedTask,
  ensureProcessingTask,
  ensureWaitingOrDelayedTask,
  getTaskError,
  getTaskEventPayload,
  getTaskOutput,
  getTaskProcessAt,
  getTaskWorkerId,
} from './typeguards';

export function buildTaskRepository({
  i,
  pool,
}: Repository): Pick<
  Storage,
  | 'addTasks'
  | 'getAvailableTasks'
  | 'getProcessingTasks'
  | 'getAssignedTasks'
  | 'cleanOutdatedTasks'
  | 'updateTasksState'
  | 'getTasksAttempts'
> {
  async function addTasks(tasks: readonly Task[]): Promise<void> {
    if (tasks.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    const { columns: taskColumns, rows: taskRows } = prepareBulkInsert(
      [
        ['id', 'uuid'],
        ['name', 'text'],
        ['input', 'json'],
        ['state', 'text'],
        ['queued_at', 'timestamptz'],
        ['process_at', 'timestamptz'],
      ],
      tasks,
      (task) => ({
        id: task.id,
        name: task.name,
        input: task.input as JsonPrimitive,
        state: task.state,
        queued_at: now,
        process_at: getTaskProcessAt(task),
      })
    );

    const { columns: eventsColumns, rows: eventsRows } = prepareBulkInsert(
      [
        ['id', 'uuid'],
        ['task_id', 'uuid'],
        ['event', 'text'],
        ['payload', 'json'],
        ['emitted_at', 'timestamptz'],
      ],
      tasks,
      (task) => ({
        id: uuidv4(),
        task_id: task.id,
        event: 'added',
        payload: getTaskEventPayload(task),
        emitted_at: now,
      })
    );

    await pool.transaction(async (trx) => {
      await trx.query(sql`
        insert into ${i('tasks')} (${taskColumns})
        select * from ${taskRows}
      `);

      await trx.query(sql`
        insert into ${i('tasks_events')} (${eventsColumns})
        select * from ${eventsRows}
      `);
    });
  }

  async function getAvailableTasks(): Promise<(WaitingTask | DelayedTask)[]> {
    const rows = await pool.any<DatabaseTask>(sql`
      select * from ${i('tasks')}
      where
        ("state" = 'waiting')
        or ("state" = 'delayed' and current_timestamp > "process_at")
      order by "queued_at" asc
    `);

    return rows.map((task) => ensureWaitingOrDelayedTask(encodeTask(task)));
  }

  async function getProcessingTasks(): Promise<ProcessingTask[]> {
    const rows = await pool.any<DatabaseTask>(sql`
      select * from ${i('tasks')}
      where
        ("state" = 'processing')
      order by "queued_at" asc
    `);

    return rows.map((task) => ensureProcessingTask(encodeTask(task)));
  }

  async function getAssignedTasks(workerId?: string): Promise<AssignedTask[]> {
    const rows = await pool.any<DatabaseTask>(sql`
      select * from ${i('tasks')}
      where
        ("state" = 'assigned')
        ${workerId ? sql`and worker_id = ${workerId}` : sql``}
      order by "queued_at" asc
    `);

    return rows.map((task) => ensureAssignedTask(encodeTask(task)));
  }

  async function updateTasksState(tasks: readonly Task[]): Promise<void> {
    if (tasks.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    const { columns: taskColumns, rows: taskRows } = prepareBulkInsert(
      [
        ['id', 'uuid'],
        ['state', 'text'],
        ['worker_id', 'text'],
        ['output', 'json'],
        ['error', 'json'],
        ['process_at', 'timestamptz'],
      ],
      tasks,
      (task) => ({
        id: task.id,
        state: task.state,
        worker_id: getTaskWorkerId(task),
        output: getTaskOutput(task),
        error: getTaskError(task),
        process_at: getTaskProcessAt(task),
      })
    );

    const { columns: eventColumns, rows: eventRows } = prepareBulkInsert(
      [
        ['id', 'uuid'],
        ['task_id', 'uuid'],
        ['event', 'text'],
        ['payload', 'json'],
        ['emitted_at', 'timestamptz'],
      ],
      tasks,
      (task) => ({
        id: uuidv4(),
        task_id: task.id,
        event: task.state,
        payload: getTaskEventPayload(task),
        emitted_at: now,
      })
    );

    await pool.transaction(async (trx) => {
      await trx.query(sql`
        update ${i('tasks')} as "task"
          set "state" = "updated_task"."state",
              "worker_id" = "updated_task"."worker_id",
              "output" = "updated_task"."output",
              "error" = "updated_task"."error",
              "process_at" = "updated_task"."process_at"
        from ${taskRows} as "updated_task" (${taskColumns})
        where "task"."id" = "updated_task"."id"
      `);

      await trx.query(sql`
        insert into ${i('tasks_events')} (${eventColumns})
        select * from ${eventRows}
      `);
    });
  }

  async function getTasksAttempts(taskIds: string[]) {
    if (taskIds.length === 0) {
      return new Map();
    }

    const tasksAttempts = await pool.any<{
      task_id: string;
      count: number;
    }>(sql`
      select "task_id", count(1) from ${i('tasks_events')}
      where "event" = 'processing'
      group by "task_id";
    `);

    return keyByWith(
      tasksAttempts,
      ({ task_id }) => task_id,
      ({ count }) => count
    );
  }

  async function cleanOutdatedTasks() {
    const now = new Date().toISOString();

    // tasks of dead workers
    const tasks = await pool.any<{ id: string }>(sql`
      select "task"."id" from ${i('tasks')} as "task"
      join ${i('workers')} as "worker"
        on "worker"."id" = "task"."worker_id"
      where current_timestamp > "worker"."ttl"
    `);

    if (!tasks.length) {
      return;
    }

    const taskIds = tasks.map(({ id }) => id);

    const { columns, rows } = prepareBulkInsert(
      [
        ['id', 'uuid'],
        ['task_id', 'uuid'],
        ['event', 'text'],
        ['payload', 'json'],
        ['emitted_at', 'timestamptz'],
      ],
      taskIds,
      (taskId) => ({
        id: uuidv4(),
        task_id: taskId,
        event: 'unassigned',
        payload: JSON.stringify({}),
        emitted_at: now,
      })
    );

    await pool.transaction(async (trx) => {
      await trx.query(sql`
        update ${i('tasks')}
        set "error" = null,
            "worker_id" = null,
            "process_at" = null
        where "id" = any(${sql.array(taskIds, 'uuid')})
      `);

      await trx.query(sql`
        insert into ${i('tasks_events')} (${columns})
        select * from ${rows}
      `);
    });
  }

  return {
    addTasks,
    getAvailableTasks,
    getProcessingTasks,
    getAssignedTasks,
    cleanOutdatedTasks,
    updateTasksState,
    getTasksAttempts,
  };
}
