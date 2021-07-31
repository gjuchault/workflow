import { Bucket } from './rateLimit';
import { Scheduler } from './scheduler';
import {
  AssignedTask,
  DelayedTask,
  ProcessingTask,
  Task,
  WaitingTask,
} from './task';
import { Worker } from './worker';

export type Storage = {
  readonly stop: () => Promise<void>;

  readonly addTasks: (tasks: readonly Task[]) => Promise<void>;
  readonly updateTasksState: (tasks: readonly Task[]) => Promise<void>;
  readonly getProcessingTasks: () => Promise<ProcessingTask[]>;
  readonly getAvailableTasks: () => Promise<(WaitingTask | DelayedTask)[]>;
  readonly getAssignedTasks: (workerId?: string) => Promise<AssignedTask[]>;
  readonly cleanOutdatedTasks: () => Promise<void>;
  readonly getTasksAttempts: (
    taskIds: string[]
  ) => Promise<Map<string, number>>;

  readonly refreshWorkersLocks: (locks: readonly string[]) => Promise<void>;
  readonly registerWorkers: (
    workers: readonly Pick<Worker, 'id'>[]
  ) => Promise<void>;

  readonly refreshSchedulersLocks: (
    schedulerIds: readonly string[]
  ) => Promise<void>;
  readonly resignDeadLeaders: () => Promise<number>;
  readonly tryToSetMasterScheduler: (
    masterSchedulerId: string
  ) => Promise<boolean>;
  readonly registerSchedulers: (
    schedulers: readonly Pick<Scheduler, 'id'>[]
  ) => Promise<void>;
  readonly unregisterSchedulers: (
    schedulerIds: readonly string[]
  ) => Promise<void>;

  readonly getRateLimiting: () => Promise<Map<string, Map<string, Bucket>>>;
  readonly setRateLimiting: (
    input: Map<string, Map<string, Bucket>>
  ) => Promise<void>;

  readonly addFlows: (
    flows: {
      id: string;
      name: string;
      input: unknown;
    }[]
  ) => Promise<void>;
  readonly assignTaskIdsToFlows: (
    links: {
      flowId: string;
      taskId: string;
    }[]
  ) => Promise<void>;
  readonly getFlowsByTaskIds: (
    taskIds: string[]
  ) => Promise<{ id: string; name: string }[]>;
  readonly markFlowTasksAsDone: (
    tasks: {
      flowId: string;
      taskId: string;
      groupId?: string;
    }[]
  ) => Promise<Map<string, { left: number; total: number }>>;
  readonly assignTaskIdsToGroups: (
    links: {
      flowId: string;
      taskId: string;
      groupId: string;
    }[]
  ) => Promise<void>;
  readonly getGroupIdsByTaskIds: (
    taskIds: string[]
  ) => Promise<Map<string, string | undefined>>;
  readonly stopFlows: (flowIds: string[]) => Promise<void>;
  readonly getAllTasksOutputsByGroupIds: (
    groupIds: string[]
  ) => Promise<Map<string, unknown[]>>;
};
