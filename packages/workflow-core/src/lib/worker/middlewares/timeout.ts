import { debug } from 'debug';

import { buildResettableSetTimeout } from '../../helpers/resettableSetTimeout';
import { createTimeoutError, TaskDefinition } from '../../task';

const log = debug('workflow:core:worker');

export function buildTimeoutMiddleware({
  taskDefinition,
  taskName,
}: {
  readonly taskDefinition: TaskDefinition;
  readonly taskName: string;
}) {
  async function timeoutMiddleware({
    runHandler,
  }: {
    readonly runHandler: (bag: { beat: () => void }) => Promise<unknown>;
  }) {
    const delay = taskDefinition.timeToLive?.taskExecutionTimeout?.taskTimeout;

    if (!delay) {
      return runHandler({
        beat: () => {
          /* noop beat */
        },
      });
    }

    const timeout = buildResettableSetTimeout({
      delay,
    });

    const failTaskWhenTimeout = new Promise((_, reject) => {
      timeout.setHandler(() => reject(createTimeoutError()));
    });

    timeout.run();

    return Promise.race([
      runHandler({
        beat: () => {
          log(`Resetting timeout for task ${taskName}`);
          timeout.reset();
        },
      }),
      failTaskWhenTimeout,
    ]);
  }

  return timeoutMiddleware;
}
