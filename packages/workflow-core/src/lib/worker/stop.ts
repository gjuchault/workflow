import { debug } from 'debug';

const log = debug('workflow:core:worker');

type StopWorkerDependencies = { id: string };

export function buildStopWorker({ id }: StopWorkerDependencies) {
  async function stop(
    isWorking: boolean,
    timeout: NodeJS.Timeout,
    params?: { maxWait?: number }
  ) {
    const maxWait = params?.maxWait ?? 5000;

    if (maxWait <= 550) {
      throw new TypeError('Expecting maxWait to be a number above 550 (ms)');
    }

    log(`stopping worker ${id}`);
    clearTimeout(timeout);

    if (!isWorking) {
      log(`stopped worker ${id}`);
      return;
    }

    log(
      `worker ${id} is working, waiting for tasks to be processed before stopping...`
    );
    const pollProcessingTasks = new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        if (!isWorking) {
          log(`stopped worker ${id}`);
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });

    const timeoutProcessingTask = new Promise<void>((_, reject) => {
      setTimeout(async () => {
        log(`couldn't stop worker ${id} in time`);
        reject(new Error(`Couldn't stop worker ${id} in time`));
      }, maxWait);
    });

    return Promise.race([pollProcessingTasks, timeoutProcessingTask]);
  }

  return stop;
}
