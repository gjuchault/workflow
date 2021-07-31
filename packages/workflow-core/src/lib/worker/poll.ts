import { debug } from 'debug';

import { Enqueue } from '../broker/enqueue';
import { Events } from '../events';
import { Storage } from '../storage';
import { getTaskDefinition, ProcessingTask, TaskDefinition } from '../task';

import { buildWorkerErrorMiddleware } from './middlewares/error';
import { buildTimeoutMiddleware } from './middlewares/timeout';

const log = debug('workflow:core:worker');

type PollWorkerDependencies = {
  readonly id: string;
  readonly storage: Storage;
  readonly events: Events;
  readonly handlers: Map<
    string,
    (
      task: Omit<ProcessingTask, 'input'> & { payload: unknown },
      bag: { attemptsMade: number; enqueue: Enqueue; beat: Beat }
    ) => Promise<unknown>
  >;
  readonly taskMap: Record<string, TaskDefinition>;
  readonly enqueue: Enqueue;
  readonly setTimeoutRef: (timeout: NodeJS.Timeout) => void;
  readonly setIsWorking: (isWorking: boolean) => void;
};

type Beat = () => void;

export function buildPollWorker({
  id,
  storage,
  events,
  handlers,
  taskMap,
  enqueue,
  setTimeoutRef,
  setIsWorking,
}: PollWorkerDependencies) {
  const errorMiddleware = buildWorkerErrorMiddleware({ storage });

  async function poll() {
    await storage.refreshWorkersLocks([id]);

    const tasks = await storage.getAssignedTasks(id);

    if (tasks.length === 0) {
      setTimeoutRef(setTimeout(poll, 5000));
      return;
    }

    setIsWorking(true);

    const taskAttempts = await storage.getTasksAttempts(
      tasks.map((task) => task.id)
    );

    for (const task of tasks) {
      log(`worker ${id} picking task ${task.name}`);

      const taskDefinition = getTaskDefinition(task, taskMap);

      const handler = handlers.get(task.name);
      if (!handler) {
        const error = { kind: 'workflowError', reason: 'missingHandler' };

        await storage.updateTasksState([
          {
            id: task.id,
            input: task.input,
            name: task.name,
            queuedAt: task.queuedAt,
            state: 'failed',
            error,
          },
        ]);

        events.emit('task:failed', {
          id: task.id,
          name: task.name,
          error,
        });
        continue;
      }

      const processingTask: ProcessingTask = {
        id: task.id,
        input: task.input,
        name: task.name,
        queuedAt: task.queuedAt,
        workerId: task.workerId,
        state: 'processing',
      };

      await storage.updateTasksState([processingTask]);

      const attemptsMade = taskAttempts.get(task.id) ?? 0;

      const timeoutMiddleware = buildTimeoutMiddleware({
        taskDefinition,
        taskName: task.name,
      });

      let output: unknown;

      try {
        output = await timeoutMiddleware({
          runHandler: ({ beat }) =>
            handler(
              {
                id: processingTask.id,
                name: processingTask.name,
                payload: processingTask.input,
                queuedAt: processingTask.queuedAt,
                state: processingTask.state,
                workerId: processingTask.workerId,
              },
              {
                attemptsMade,
                enqueue,
                beat,
              }
            ),
        });
      } catch (err) {
        await errorMiddleware({
          task,
          processingTask,
          taskDefinition,
          attemptsMade,
          err,
        });
        setTimeoutRef(setTimeout(poll, 5000));
        return;
      }

      await storage.updateTasksState([
        {
          id: processingTask.id,
          input: processingTask.input,
          name: processingTask.name,
          queuedAt: processingTask.queuedAt,
          state: 'done',
          output,
        },
      ]);
      events.emit('task:done', {
        id: processingTask.id,
        name: processingTask.name,
        output,
      });

      log(`worker ${id} finished task ${task.name}`);
      setTimeoutRef(setTimeout(poll, 5000));
    }

    setIsWorking(false);
  }

  return poll;
}
