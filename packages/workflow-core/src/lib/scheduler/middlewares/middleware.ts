import {
  AssignedTask,
  DelayedTask,
  ProcessingTask,
  TaskDefinition,
  WaitingTask,
} from '../../task';

export type SchedulerMiddlewareFlow = {
  taskMap: Record<string, TaskDefinition>;
  processingTasks: readonly ProcessingTask[];
  assignedTasks: readonly AssignedTask[];
  acceptingTasks: readonly (WaitingTask | DelayedTask)[];
  rejectingTasks: readonly (WaitingTask | DelayedTask)[];
};

export type Middleware = (
  input: SchedulerMiddlewareFlow
) => Promise<SchedulerMiddlewareFlow>;
