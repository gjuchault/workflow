import { v4 as uuidv4 } from 'uuid';

import { Enqueue, EnqueueOptions } from '../broker/enqueue';
import { Storage } from '../storage';

import { CallbackMap } from './callbackMap';

type FlowControllerDependencies = {
  flowId: string;
  flowName: string;
  callbackMap: CallbackMap;
  enqueue: Enqueue;
  storage: Storage;
};

type Group = { id: string };

export type FlowController<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
> = {
  readonly enqueue: (
    name: keyof TaskMap,
    input: TaskMap[keyof TaskMap]['input'],
    options?: EnqueueOptions & { group?: Group }
  ) => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly createGroup: () => Group;
  // TODO: on task failed
  // TODO: on group progress
  readonly onTaskDone: <TaskName extends keyof TaskMap>(
    taskName: TaskName,
    callback: (output: TaskMap[TaskName]['output']) => void
  ) => void;
  readonly onGroupTaskDone: <TaskName extends keyof TaskMap>(
    groupName: TaskName,
    callback: (output: TaskMap[TaskName]['output'][]) => void
  ) => void;
};

export function buildFlowController<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
>({
  flowId,
  flowName,
  callbackMap,
  enqueue,
  storage,
}: FlowControllerDependencies): FlowController<TaskMap> {
  return {
    async enqueue(
      name: keyof TaskMap,
      input: TaskMap[keyof TaskMap]['input'],
      options: EnqueueOptions & { group?: Group } = {}
    ) {
      if (typeof name !== 'string') {
        throw new TypeError(
          `Expected name to be string, but got ${typeof name}`
        );
      }

      const taskId = await enqueue(name, input, options);

      if (!taskId) {
        throw new Error(`Can not enqueue ${name}: broker refused to take task`);
      }

      await storage.assignTaskIdsToFlows([{ flowId, taskId }]);

      if (options.group) {
        await storage.assignTaskIdsToGroups([
          {
            flowId,
            taskId,
            groupId: options.group.id,
          },
        ]);
      }
    },

    async stop() {
      await storage.stopFlows([flowId]);
    },

    createGroup() {
      return { id: uuidv4() };
    },

    onTaskDone<TaskName extends keyof TaskMap>(
      taskName: TaskName,
      callback: (output: TaskMap[TaskName]['output']) => void
    ) {
      if (typeof taskName !== 'string') {
        throw new TypeError(
          `Expecting taskName to be string, but got ${typeof taskName}`
        );
      }

      callbackMap.add(flowName, flowId, 'task', taskName, callback);
    },

    onGroupTaskDone<TaskName extends keyof TaskMap>(
      groupName: TaskName,
      callback: (output: TaskMap[TaskName]['output'][]) => void
    ) {
      if (typeof groupName !== 'string') {
        throw new TypeError(
          `Expecting groupName to be string, but got ${typeof groupName}`
        );
      }

      callbackMap.add(
        flowName,
        flowId,
        'group',
        groupName,
        // FIXME: find another way of having to cast [] to unknown
        callback as (output: unknown) => void
      );
    },
  };
}
