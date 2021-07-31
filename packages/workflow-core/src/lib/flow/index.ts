import { debug } from 'debug';
import { v4 as uuidv4 } from 'uuid';

import { Enqueue } from '../broker/enqueue';
import { Events } from '../events';
import { Storage } from '../storage';

import { buildCallbackMap } from './callbackMap';
import { buildFlowController, FlowController } from './flowController';
import { buildHandleTaskDone } from './handleTaskDone';

const log = debug('workflow:core:flow');

export type CreateFlow<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
> = <Input>(
  flowId: string,
  describeFlow: DescribeFlow<TaskMap, Input>
) => Promise<Flow<Input>>;

type Flow<Input> = {
  readonly start: (input: Input) => Promise<void>;
};

type DescribeFlow<
  TaskMap extends Record<string, { input: unknown; output: unknown }>,
  Input
> = (flow: FlowController<TaskMap>, input: Input) => void;

export type CreateCreateFlowDependencies = {
  readonly storage: Storage;
  readonly events: Events;
  readonly enqueue: Enqueue;
};

export async function createCreateFlow<
  TaskMap extends Record<string, { input: unknown; output: unknown }>
>({
  storage,
  events,
  enqueue,
}: CreateCreateFlowDependencies): Promise<CreateFlow<TaskMap>> {
  const callbackMap = buildCallbackMap();
  const handleTaskDone = buildHandleTaskDone({
    storage,
    callbackMap,
  });

  events.on('task:done', handleTaskDone);

  async function createFlow<Input>(
    flowName: string,
    describeFlow: DescribeFlow<TaskMap, Input>
  ) {
    const flowId = uuidv4();
    log(`Creating flow ${flowId}`);

    return {
      async start(flowInput: Input) {
        log(`Starting flow ${flowId}`);
        await storage.addFlows([
          { id: flowId, name: flowName, input: flowInput },
        ]);

        const flowDescriptor = buildFlowController<TaskMap>({
          flowId,
          flowName,
          callbackMap,
          enqueue,
          storage,
        });

        // should we make this async?
        describeFlow(flowDescriptor, flowInput);
      },
    };
  }

  return createFlow;
}
