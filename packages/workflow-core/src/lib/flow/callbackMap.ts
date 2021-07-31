export type CallbackMap = {
  add(
    flowName: string,
    flowId: string,
    type: 'task' | 'group',
    taskOrGroupName: string,
    callback: (output: unknown) => void
  ): string;
  getKeys(
    flowName: string,
    flowId: string,
    type: 'task' | 'group',
    taskOrGroupName: string
  ): string[];
  getCallbacks(keys: string[]): ((output: unknown) => void)[];
};

export function buildCallbackMap(): CallbackMap {
  const map = new Map<string, (output: unknown) => void>();
  const allCallbackKeysByTaskOrGroupKey = new Map<string, string[]>();
  const taskOrGroupNameCountMap = new Map<string, number>();

  return {
    add(
      flowName: string,
      flowId: string,
      type: 'task' | 'group',
      taskOrGroupName: string,
      callback: (output: unknown) => void
    ) {
      const taskOrGroupKey = [flowName, flowId, type, taskOrGroupName].join(
        '-'
      );

      const taskOrGroupKeyCount =
        taskOrGroupNameCountMap.get(taskOrGroupKey) ?? 0;
      const key = [taskOrGroupKey, taskOrGroupKeyCount].join('-');

      taskOrGroupNameCountMap.set(taskOrGroupKey, taskOrGroupKeyCount + 1);
      map.set(key, callback);

      allCallbackKeysByTaskOrGroupKey.set(taskOrGroupKey, [
        ...(allCallbackKeysByTaskOrGroupKey.get(taskOrGroupKey) ?? []),
        key,
      ]);

      return key;
    },
    getKeys(
      flowName: string,
      flowId: string,
      type: 'task' | 'group',
      taskOrGroupName: string
    ) {
      const taskOrGroupKey = [flowName, flowId, type, taskOrGroupName].join(
        '-'
      );

      return allCallbackKeysByTaskOrGroupKey.get(taskOrGroupKey) ?? [];
    },
    getCallbacks(keys: string[]) {
      const callbacks: ((output: unknown) => void)[] = [];

      for (const key of keys) {
        const callback = map.get(key);

        if (callback) {
          callbacks.push(callback);
        }
      }

      return callbacks;
    },
  };
}
