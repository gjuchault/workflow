import { debug } from 'debug';

import { rejectUnexpectedValue } from '../../helpers/switchGuard';
import { Storage } from '../../storage';
import {
  AssignedTask,
  defaultRetryStrategy,
  isTimeoutError,
  ProcessingTask,
  Task,
  TaskDefinition,
} from '../../task';

const log = debug('workflow:core:worker');

type WorkerErrorHandlerDependencies = {
  readonly storage: Storage;
};

export function buildWorkerErrorMiddleware({
  storage,
}: WorkerErrorHandlerDependencies) {
  async function errorMiddleware({
    task,
    attemptsMade,
    processingTask,
    taskDefinition,
    err,
  }: {
    task: AssignedTask;
    attemptsMade: number;
    processingTask: ProcessingTask;
    taskDefinition: TaskDefinition;
    err: unknown;
  }) {
    if (isTimeoutError(err)) {
      log(`task ${task.id} (${task.name}) timed out`);

      const policy = taskDefinition.timeToLive?.taskExecutionTimeout?.policy;

      const nextTaskStates: Task[] = [
        {
          id: processingTask.id,
          input: processingTask.input,
          name: processingTask.name,
          queuedAt: processingTask.queuedAt,
          state: 'failed',
          error: {
            kind: 'workflowError',
            reason: 'taskExecutionTimeout',
            taskExecutionTimeout:
              taskDefinition.timeToLive?.taskExecutionTimeout,
            policy,
          },
        },
      ];

      switch (policy) {
        case 'retry':
          nextTaskStates.push({
            id: processingTask.id,
            input: processingTask.input,
            name: processingTask.name,
            queuedAt: processingTask.queuedAt,
            state: 'waiting',
          });
          break;
        case 'abort':
          break;
        case undefined:
          break;
        default:
          rejectUnexpectedValue('policy', policy);
      }

      await storage.updateTasksState(nextTaskStates);

      return;
    }

    log(`task ${task.id} (${task.name}) failed`);

    await storage.updateTasksState([
      {
        id: processingTask.id,
        input: processingTask.input,
        name: processingTask.name,
        queuedAt: processingTask.queuedAt,
        state: 'failed',
        error: {
          kind: 'workflowError',
          reason: 'handlerException',
          cause: err ?? `Error is ${err}`,
        },
      },
    ]);

    if (taskDefinition.retry) {
      const delayFn =
        taskDefinition.retry.getRetryDelay ?? defaultRetryStrategy;

      if (
        !taskDefinition.retry.maximumRetries ||
        attemptsMade < taskDefinition.retry.maximumRetries
      ) {
        return storage.updateTasksState([
          {
            id: processingTask.id,
            input: processingTask.input,
            name: processingTask.name,
            queuedAt: processingTask.queuedAt,
            state: 'delayed',
            processAt: new Date(Date.now() + delayFn(attemptsMade)),
          },
        ]);
      }
    }
  }

  return errorMiddleware;
}
