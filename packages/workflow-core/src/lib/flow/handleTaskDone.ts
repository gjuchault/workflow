import debug from 'debug';

import { Storage } from '../storage';

import { CallbackMap } from './callbackMap';

const log = debug('workflow:core:flow');

type HandleTaskDoneDependencies = {
  storage: Storage;
  callbackMap: CallbackMap;
};

export function buildHandleTaskDone({
  storage,
  callbackMap,
}: HandleTaskDoneDependencies) {
  return async function handleTaskDone({
    id,
    name,
    output,
  }: {
    id: string;
    name: string;
    output: unknown;
  }) {
    const [flow] = await storage.getFlowsByTaskIds([id]);

    if (!flow) return;

    log(
      `Triggering callbacks for task ${id} (${name}), belonging to flow ${flow.id}`
    );

    const keys = callbackMap.getKeys(flow.name, flow.id, 'task', name);
    const callbacks = callbackMap.getCallbacks(keys);

    for (const callback of callbacks) {
      callback(output);
    }

    const groupIdsByTaskIds = await storage.getGroupIdsByTaskIds([id]);
    const groupId = groupIdsByTaskIds.get(id);

    const taskCountersByGroupId = await storage.markFlowTasksAsDone([
      {
        flowId: flow.id,
        taskId: id,
        groupId,
      },
    ]);

    if (groupId) {
      const taskCounters = taskCountersByGroupId.get(groupId);

      log(
        `Group ${groupId} tasks progress is ${taskCounters?.left} / ${taskCounters?.total}`
      );

      if (taskCounters === undefined || taskCounters.left === 0) {
        log(
          `Triggering callbacks for group ${groupId}, belonging to flow ${flow.id}`
        );

        const allTasksOutputByGroupId = await storage.getAllTasksOutputsByGroupIds(
          [groupId]
        );
        const allTasksOutput = allTasksOutputByGroupId.get(groupId) ?? [];

        const keys = callbackMap.getKeys(flow.name, flow.id, 'group', name);

        const callbacks = callbackMap.getCallbacks(keys);

        for (const callback of callbacks) {
          callback(allTasksOutput);
        }
      }
    }
  };
}
