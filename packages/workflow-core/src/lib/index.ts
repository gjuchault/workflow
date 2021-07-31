import * as os from 'os';

import { debug } from 'debug';

import { createBroker } from './broker';
import { Enqueue } from './broker/enqueue';
import { buildEvents } from './events';
import { createCreateFlow, CreateFlow } from './flow';
import { createLeadershipEngine } from './leadership';
import { createScheduler } from './scheduler';
import { Storage } from './storage';
import { ProcessingTask, TaskDefinition } from './task';
import { createWorker, Worker } from './worker';

const log = debug('workflow:core');

type WorkflowEngineDependencies<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
> = {
  readonly name: string;
  readonly storage: Storage;
  readonly taskMap: {
    [TaskInputName in keyof TaskMap]: TaskDefinition;
  };
};

type Handler<Payload> = (
  task: Omit<ProcessingTask, 'input'> & { payload: Payload },
  bag: {
    /**
     * Number of times the task was tried before this handler is called (the
     * first time the handler is called, `attemptsMade` is 0)
     */
    attemptsMade: number;
    enqueue: Enqueue;
    beat: () => void;
  }
) => Promise<unknown>;

type WorkflowEngine<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
> = {
  readonly registerHandler: <TaskName extends keyof TaskMap>(
    taskName: TaskName,
    handler: Handler<TaskMap[TaskName]['input']>
  ) => void;
  readonly startWorker: () => Promise<Worker>;
  readonly start: () => void;
  readonly stop: (params?: { maxWait?: number }) => Promise<void>;
  readonly enqueue: Enqueue;
  readonly createFlow: CreateFlow<TaskMap>;
};

export async function createWorkflowEngine<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
>({
  name,
  storage,
  taskMap,
}: WorkflowEngineDependencies<TaskMap>): Promise<WorkflowEngine<TaskMap>> {
  const events = buildEvents();

  const instanceName = `${os.hostname()}_${process.pid}_${name}`;

  const handlers: Map<string, Handler<unknown>> = new Map();

  log('Starting workflow engine %s...', instanceName);
  const workers: Worker[] = [];

  log('Starting leadership engine...');
  const leadership = createLeadershipEngine({
    storage,
    events,
  });

  log('Starting scheduler...');
  const scheduler = await createScheduler({
    instanceName,
    storage,
    workers,
    taskMap,
    leadership,
    events,
  });

  const broker = createBroker({ storage, events, taskMap });

  const createFlow = await createCreateFlow<TaskMap>({
    storage,
    enqueue: broker.enqueue,
    events,
  });

  return {
    registerHandler(name, handler) {
      if (typeof name !== 'string') {
        throw new TypeError(`Expected name to be string, got ${typeof name}`);
      }

      handlers.set(name, handler);
    },

    enqueue: broker.enqueue,

    createFlow,

    async startWorker() {
      const worker = createWorker({
        instanceName,
        workersCount: workers.length,
        storage,
        events,
        handlers,
        taskMap,
        enqueue: broker.enqueue,
      });

      workers.push(worker);

      await worker.start();

      return worker;
    },

    async start() {
      return scheduler.start();
    },

    async stop(params?: { maxWait?: number }) {
      await Promise.all([
        ...workers.map((worker) => worker.stop(params)),
        scheduler.stop(),
      ]);
    },
  };
}
