import {
  AssignedTask,
  DelayedTask,
  getTaskDefinition,
  ProcessingTask,
  WaitingTask,
} from '../../task';

import { SchedulerMiddlewareFlow } from './middleware';

export function concurrencyMiddleware(
  input: SchedulerMiddlewareFlow
): SchedulerMiddlewareFlow {
  const { accepted, rejected } = concurrency<
    ProcessingTask | AssignedTask,
    WaitingTask | DelayedTask
  >(
    [...input.processingTasks, ...input.assignedTasks],
    input.acceptingTasks,
    (task) => {
      const taskDefinition = getTaskDefinition(task, input.taskMap);

      return taskDefinition.concurrency?.maximumConcurrent || -1;
    },
    (task) => {
      return task.name;
    }
  );

  return {
    taskMap: input.taskMap,
    processingTasks: input.processingTasks,
    assignedTasks: input.assignedTasks,
    acceptingTasks: accepted,
    rejectingTasks: rejected,
  };
}

function concurrency<ExistingItem, QueuedItem>(
  existingItems: readonly ExistingItem[],
  queuedItems: readonly QueuedItem[],
  maximumIteratee: (item: QueuedItem) => number,
  idIteratee: (item: ExistingItem | QueuedItem) => string
): {
  accepted: readonly QueuedItem[];
  rejected: readonly QueuedItem[];
} {
  const countPerId: Map<string, number> = new Map();
  const accepted: QueuedItem[] = [];
  const rejected: QueuedItem[] = [];

  for (const item of existingItems) {
    const id = idIteratee(item);
    const count = countPerId.get(id) ?? 0;
    countPerId.set(id, count + 1);
  }

  for (const item of queuedItems) {
    const id = idIteratee(item);
    const count = countPerId.get(id) ?? 0;
    const max = maximumIteratee(item);

    if (max <= 0 || count < max) {
      accepted.push(item);
      countPerId.set(id, count + 1);
    } else {
      rejected.push(item);
    }
  }

  return { accepted, rejected };
}
