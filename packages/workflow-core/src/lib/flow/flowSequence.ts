export type FlowSequenceItem =
  | {
      kind: 'onTaskDone';
      flowId: string;
      key: string;
      payload: {
        taskName: string;
      };
    }
  | {
      kind: 'onGroupDone';
      flowId: string;
      key: string;
      payload: {
        groupName: string;
      };
    };
