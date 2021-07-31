import {
  AssignedTask,
  DelayedTask,
  getTaskDefinition,
  ProcessingTask,
  TaskDefinition,
  WaitingTask,
} from '../../task';

export function highWaterMiddleware(payload: {
  taskMap: Record<string, TaskDefinition>;
  availableTasks: readonly (WaitingTask | DelayedTask)[];
  processingTasks: readonly ProcessingTask[];
  assignedTasks: readonly AssignedTask[];
  enqueueingTask: {
    name: string;
    input: unknown;
  };
}): { count: number; highWater: number } {
  const { name } = payload.enqueueingTask;
  const taskDefinition = getTaskDefinition({ name }, payload.taskMap);

  const taskCountByTaskName: Map<string, number> = new Map();

  for (const { name } of [
    ...payload.assignedTasks,
    ...payload.availableTasks,
    ...payload.processingTasks,
  ]) {
    taskCountByTaskName.set(name, (taskCountByTaskName.get(name) ?? 0) + 1);
  }

  const tasksCount = taskCountByTaskName.get(name) ?? 0;

  return {
    count: tasksCount,
    highWater: taskDefinition.highWater?.maximumInQueue ?? Infinity,
  };
}
