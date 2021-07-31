import { debug } from 'debug';

import { Enqueue } from '../broker/enqueue';
import { Events } from '../events';
import { Storage } from '../storage';
import { ProcessingTask, TaskDefinition } from '../task';

import { buildPollWorker } from './poll';
import { buildStopWorker } from './stop';

const log = debug('workflow:core:worker');

export type Worker = {
  readonly id: string;
  readonly start: () => Promise<void>;
  readonly stop: (params?: { maxWait?: number }) => Promise<void>;
};

export type CreateWorkerDependencies = {
  readonly instanceName: string;
  readonly workersCount: number;
  readonly storage: Storage;
  readonly events: Events;
  readonly handlers: Map<
    string,
    (
      task: Omit<ProcessingTask, 'input'> & { payload: unknown },
      bag: { attemptsMade: number; enqueue: Enqueue; beat: () => void }
    ) => Promise<unknown>
  >;
  readonly taskMap: Record<string, TaskDefinition>;
  readonly enqueue: Enqueue;
};

export function createWorker({
  instanceName,
  workersCount,
  storage,
  events,
  handlers,
  taskMap,
  enqueue,
}: CreateWorkerDependencies): Worker {
  const id = generateWorkerId(instanceName, workersCount + 1);

  let timeout: NodeJS.Timeout;
  let isWorking = false;

  const poll = buildPollWorker({
    id,
    storage,
    events,
    handlers,
    taskMap,
    enqueue,
    setTimeoutRef(newTimeout) {
      timeout = newTimeout;
    },
    setIsWorking(newIsWorking) {
      isWorking = newIsWorking;
    },
  });

  const stopWorker = buildStopWorker({
    id,
  });

  async function start() {
    log('Starting worker polling');

    await storage.registerWorkers([{ id }]);
    poll();

    return;
  }

  async function stop(params?: { maxWait?: number }) {
    return stopWorker(isWorking, timeout, params);
  }

  return {
    id,
    start,
    stop,
  };
}

export function generateWorkerId(
  instanceName: string,
  workersCount: number
): string {
  return `${instanceName}_workers_${workersCount}`;
}
