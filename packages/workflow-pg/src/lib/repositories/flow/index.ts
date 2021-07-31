import type { Storage } from '@workflow/core';
import { sql } from 'slonik';

import { groupByWith } from '../../helpers/groupBy';
import { prepareBulkInsert } from '../../helpers/slonik';
import { Repository } from '../repository';

export function buildFlowRepository({
  i,
  pool,
}: Repository): Pick<
  Storage,
  | 'addFlows'
  | 'assignTaskIdsToFlows'
  | 'getFlowsByTaskIds'
  | 'markFlowTasksAsDone'
  | 'assignTaskIdsToGroups'
  | 'getGroupIdsByTaskIds'
  | 'getAllTasksOutputsByGroupIds'
  | 'stopFlows'
> {
  async function addFlows(
    flows: {
      id: string;
      name: string;
      input: unknown;
    }[]
  ) {
    const { columns, rows } = prepareBulkInsert(
      [
        ['id', 'uuid'],
        ['name', 'text'],
        ['input', 'json'],
      ],
      flows,
      (flow) => ({
        id: flow.id,
        name: flow.name,
        input: JSON.stringify(flow.input),
      })
    );

    await pool.query(sql`
      insert into ${i('flows')} (${columns})
      select * from ${rows}
    `);
  }

  async function assignTaskIdsToFlows(
    links: {
      taskId: string;
      flowId: string;
    }[]
  ): Promise<void> {
    const { columns, rows } = prepareBulkInsert(
      [
        ['task_id', 'uuid'],
        ['flow_id', 'uuid'],
      ],
      links,
      (link) => ({
        task_id: link.taskId,
        flow_id: link.flowId,
      })
    );

    await pool.query(sql`
      insert into ${i('flow_tasks')} (${columns})
      select * from ${rows}
      on conflict ("task_id") do nothing;
    `);
  }

  async function assignTaskIdsToGroups(
    links: {
      flowId: string;
      taskId: string;
      groupId: string;
    }[]
  ): Promise<void> {
    const { columns, rows } = prepareBulkInsert(
      [
        ['task_id', 'uuid'],
        ['flow_id', 'uuid'],
        ['group_id', 'uuid'],
      ],
      links,
      (link) => ({
        task_id: link.taskId,
        flow_id: link.flowId,
        group_id: link.groupId,
      })
    );

    await pool.query(sql`
      insert into ${i('flow_tasks_groups')} (${columns})
      select * from ${rows}
      on conflict ("task_id") do nothing;
    `);
  }

  async function getFlowsByTaskIds(
    taskIds: string[]
  ): Promise<{ id: string; name: string }[]> {
    const flows = await pool.any<{ id: string; name: string }>(sql`
      select "flows"."id", "flows"."name"
      from ${i('flow_tasks')}
      join ${i('flows')}
        on "flow_tasks"."flow_id" = "flows"."id"
      where "task_id" = any(${sql.array(taskIds, 'uuid')});
    `);

    return Array.from(flows);
  }

  async function markFlowTasksAsDone(
    tasks: {
      taskId: string;
      groupId?: string;
    }[]
  ): Promise<Map<string, { left: number; total: number }>> {
    const taskIds: string[] = [];
    const groupsIds: string[] = [];

    for (const { taskId, groupId } of tasks) {
      taskIds.push(taskId);

      if (groupId) {
        groupsIds.push(groupId);
      }
    }

    await pool.transaction(async (trx) => {
      await trx.query(sql`
        update ${i('flow_tasks_groups')}
          set "is_task_done" = true
        where "task_id" = any(${sql.array(taskIds, 'uuid')})
      `);

      await trx.query(sql`
        update ${i('flow_tasks')}
          set "is_task_done" = true
        where "task_id" = any(${sql.array(taskIds, 'uuid')})
      `);
    });

    const groupCounts = await pool.any<{
      group_id: string;
      left: number;
      total: number;
    }>(sql`
      select
        "group_id",
        sum(1) - sum(case "is_task_done" when true then 1 else 0 end) as "left",
        sum(1) as "total"
      from ${i('flow_tasks_groups')}
      where "group_id" = any(${sql.array(groupsIds, 'uuid')})
      group by "group_id"
    `);

    return new Map(
      groupCounts.map(({ group_id, left, total }) => [
        group_id,
        { left, total },
      ])
    );
  }

  async function getGroupIdsByTaskIds(
    taskIds: string[]
  ): Promise<Map<string, string | undefined>> {
    const result = await pool.any<{ task_id: string; group_id: string }>(sql`
      select "task_id", "group_id"
      from ${i('flow_tasks_groups')}
      where "task_id" = any(${sql.array(taskIds, 'uuid')})
    `);

    return new Map(
      result.map((entry) => {
        return [entry.task_id, entry.group_id];
      })
    );
  }

  async function getAllTasksOutputsByGroupIds(
    groupIds: string[]
  ): Promise<Map<string, unknown[]>> {
    const outputs = await pool.any<{ group_id: string; output: unknown }>(sql`
      select "task_group"."group_id", "task"."output"
      from ${i('flow_tasks_groups')} "task_group"
      join ${i('tasks')} "task"
        on "task"."id" = "task_group"."task_id"
      where "task_group"."group_id" = any(${sql.array(groupIds, 'uuid')})
    `);

    return groupByWith(
      outputs,
      ({ group_id }) => group_id,
      ({ output }) => output
    );
  }

  async function stopFlows(flowIds: string[]): Promise<void> {
    await pool.query(sql`
      update ${i('flows')}
        set "done_at" = now()
      where "id" = any(${sql.array(flowIds, 'uuid')});
    `);
  }

  return {
    addFlows,
    assignTaskIdsToFlows,
    getFlowsByTaskIds,
    markFlowTasksAsDone,
    assignTaskIdsToGroups,
    getGroupIdsByTaskIds,
    getAllTasksOutputsByGroupIds,
    stopFlows,
  };
}
