import { RateLimitingRule } from './rateLimit';

export type TaskDefinition = {
  /**
   * Add rate limiting policy to the task
   * Examples:
   * 50 tasks per minute
   * { rules: [ initialAmount: 50, restoreEvery: 1000 * 60, amountRestored: 50 ] }
   */
  readonly rateLimit?: {
    readonly rules: RateLimitingRule[];

    /**
     * Sets the group of tasks concerned by the rate limit
     */
    readonly getRateLimitingKey: () => string;
  };

  /**
   * Add timing out policy to the task
   */
  readonly timeToLive?: {
    /**
     * What to do when the task is not picked up by a worker
     */
    readonly taskTimeToLive?: {
      readonly policy: 'abort';
      readonly taskTimeout: number;
    };

    /**
     * What to do when the task is not picked up by a worker
     */
    readonly taskExecutionTimeout?: {
      readonly policy: 'retry' | 'abort';
      readonly taskTimeout: number;
    };
  };

  /**
   * Add concurrency policy to the task
   */
  readonly concurrency?: {
    /**
     * Maximum amount of tasks that can be picked by workers at a given time
     */
    readonly maximumConcurrent: number;
  };

  /**
   * Add high water policy to the task
   */
  readonly highWater?: {
    /**
     * Strategy to use when too many tasks are in the queue
     * block: deny any enqueue calls of this task
     */
    readonly policy: 'block';

    /**
     * Maximum amount of task in the queue (includes tasks being processed)
     */
    readonly maximumInQueue: number;
  };

  /**
   * Add retry policy to the task
   */
  readonly retry?: {
    /**
     * Maximum of times the task will be retried before aborted
     */
    readonly maximumRetries?: number;

    /**
     * Customize backoff strategy (default exponential starting at 1s)
     */
    readonly getRetryDelay?: (attemptsMade: number) => number;
  };

  /**
   * Periodically executes the task (distributed cron)
   * @deprecated
   */
  readonly periodic?: {
    format: 'cron' | 'human';
    pattern: string;
  };
};

type BaseTask = {
  readonly name: string;
  readonly id: string;
  readonly input: unknown;
  readonly queuedAt: Date;
};

export type WaitingTask = BaseTask & {
  readonly state: 'waiting';
};

export type DelayedTask = BaseTask & {
  readonly state: 'delayed';
  readonly processAt: Date;
};

export type AssignedTask = BaseTask & {
  readonly state: 'assigned';
  readonly workerId: string;
};

export type ProcessingTask = BaseTask & {
  readonly state: 'processing';
  readonly workerId: string;
};

export type FailedTask = BaseTask & {
  readonly state: 'failed';
  readonly error: unknown;
};

export type DoneTask = BaseTask & {
  readonly state: 'done';
  readonly output: unknown;
};

export type Task =
  | WaitingTask
  | DelayedTask
  | AssignedTask
  | ProcessingTask
  | FailedTask
  | DoneTask;

export type TaskState = Task['state'];

export function getTaskDefinition(
  { name }: { name: string },
  taskMap: Record<string, TaskDefinition>
): TaskDefinition {
  const taskDefinition = taskMap[name];

  if (!taskDefinition) {
    throw new Error(
      `Unknown task ${name}. It is missing from the workflow taskMap`
    );
  }

  return taskDefinition;
}

export function defaultRetryStrategy(attemptsMade: number): number {
  return 2 ** attemptsMade * 1000;
}

export function createTimeoutError() {
  return {
    isTimeoutError: true,
  };
}

export function isTimeoutError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  return Boolean(err && 'isTimeoutError' in err);
}
