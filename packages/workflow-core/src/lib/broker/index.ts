import { debug } from 'debug';
import { v4 as uuidv4 } from 'uuid';

import { Events } from '../events';
import { Storage } from '../storage';
import { getTaskDefinition, TaskDefinition } from '../task';

import { Enqueue, EnqueueOptions } from './enqueue';
import { highWaterMiddleware } from './middlewares/highwater';

const log = debug('workflow:core:broker');

export type Broker = {
  enqueue: Enqueue;
};

export type CreateBrokerDependencies = {
  readonly storage: Storage;
  readonly events: Events;
  readonly taskMap: Record<string, TaskDefinition>;
};

export function createBroker({
  storage,
  events,
  taskMap,
}: CreateBrokerDependencies): Broker {
  async function enqueue(
    name: string,
    input: unknown,
    options: EnqueueOptions = {}
  ): Promise<string | undefined> {
    const taskDefinition = getTaskDefinition({ name }, taskMap);

    if (!taskDefinition.highWater?.maximumInQueue) {
      return processEnqueue(name, input, options);
    }

    const [assignedTasks, availableTasks, processingTasks] = await Promise.all([
      storage.getAssignedTasks(),
      storage.getAvailableTasks(),
      storage.getProcessingTasks(),
    ]);

    const { count, highWater } = highWaterMiddleware({
      assignedTasks,
      availableTasks,
      enqueueingTask: { name, input },
      processingTasks,
      taskMap,
    });

    if (count >= highWater) {
      log(`Refusing task ${name} because there are already ${count}`);
      return;
    }

    const id = await processEnqueue(name, input, options);

    events.emit('task:enqueued', id);

    return id;
  }

  async function processEnqueue(
    name: string,
    input: unknown,
    options: EnqueueOptions
  ): Promise<string> {
    const id = uuidv4();

    if (options.processAt) {
      await storage.addTasks([
        {
          id,
          state: 'delayed',
          queuedAt: new Date(),
          processAt: options.processAt,
          name: name,
          input,
        },
      ]);
    } else {
      await storage.addTasks([
        {
          id,
          state: 'waiting',
          queuedAt: new Date(),
          name: name,
          input,
        },
      ]);
    }

    return id;
  }

  return {
    enqueue,
  };
}

export function generateSchedulerId(instanceName: string): string {
  return `${instanceName}_scheduler`;
}
