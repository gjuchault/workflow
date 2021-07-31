import { debug } from 'debug';

import { Events } from '../events';
import { LeadershipEngine } from '../leadership';
import { buildRateLimiter } from '../rateLimit';
import { Storage } from '../storage';
import { AssignedTask, TaskDefinition } from '../task';
import { Worker } from '../worker';

import { concurrencyMiddleware } from './middlewares/concurrency';
import {
  getRulesByKeyFromTaskMap,
  rateLimiterMiddleware,
} from './middlewares/rateLimit';

const log = debug('workflow:core:scheduler');

export type Scheduler = {
  readonly id: string;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
};

export type CreateSchedulerDependencies = {
  readonly instanceName: string;
  readonly storage: Storage;
  readonly workers: Worker[];
  readonly taskMap: Record<string, TaskDefinition>;
  readonly leadership: LeadershipEngine;
  readonly events: Events;
};

export async function createScheduler({
  instanceName,
  storage,
  workers,
  taskMap,
  leadership,
  events,
}: CreateSchedulerDependencies): Promise<Scheduler> {
  const id = generateSchedulerId(instanceName);
  const rateLimiter = buildRateLimiter({
    rulesByKey: getRulesByKeyFromTaskMap(taskMap),
    async onSaveBuckets(bucketsByRateLimitingKey) {
      await storage.setRateLimiting(bucketsByRateLimitingKey);
    },
    initialBucketsByRateLimitingKey: await storage.getRateLimiting(),
  });
  let roundRobinWorkerIndex = -1;

  let timeout: NodeJS.Timeout;
  let isLeader = false;

  async function start() {
    log('Starting scheduler polling');

    await storage.registerSchedulers([{ id }]);
    poll();

    return;
  }

  async function poll() {
    timeout = setTimeout(poll, 5000);

    const newIsLeader = await leadership.tryToTakeLeadership(id);

    if (newIsLeader && !isLeader) {
      log(`Scheduler ${id} got leadership`);
    }

    isLeader = newIsLeader;

    if (!isLeader) {
      return;
    }

    await storage.cleanOutdatedTasks();

    const [availableTasks, processingTasks, assignedTasks] = await Promise.all([
      storage.getAvailableTasks(),
      storage.getProcessingTasks(),
      storage.getAssignedTasks(),
    ]);

    const concurrencyResult = concurrencyMiddleware({
      acceptingTasks: availableTasks,
      rejectingTasks: [],
      processingTasks,
      assignedTasks,
      taskMap,
    });

    const rateLimiterResult = await rateLimiterMiddleware(
      concurrencyResult,
      rateLimiter
    );

    const nextAssignedTasks: AssignedTask[] = rateLimiterResult.acceptingTasks.map(
      (task) => ({
        ...task,
        state: 'assigned',
        workerId: getNextWorkerId(),
      })
    );

    await storage.updateTasksState(nextAssignedTasks);

    for (const updatedTask of nextAssignedTasks) {
      events.emit('task:assigned', updatedTask.id);
    }
  }

  async function stop() {
    clearTimeout(timeout);

    await storage.unregisterSchedulers([id]);
  }

  function getNextWorkerId() {
    roundRobinWorkerIndex += 1;

    return workers[roundRobinWorkerIndex % workers.length].id;
  }

  return {
    id,
    start,
    stop,
  };
}

export function generateSchedulerId(instanceName: string): string {
  return `${instanceName}_scheduler`;
}
