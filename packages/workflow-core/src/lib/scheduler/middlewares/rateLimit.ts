import { RateLimiter, RateLimitingRule } from '../../rateLimit';
import {
  DelayedTask,
  getTaskDefinition,
  TaskDefinition,
  WaitingTask,
} from '../../task';

import { SchedulerMiddlewareFlow } from './middleware';

export function getRulesByKeyFromTaskMap(
  taskMap: Record<string, TaskDefinition>
) {
  const rulesByKey = new Map<string, RateLimitingRule[]>();

  for (const taskDefinition of Object.values(taskMap)) {
    if (!taskDefinition.rateLimit) {
      continue;
    }

    const rateLimitingKey = taskDefinition.rateLimit.getRateLimitingKey();

    rulesByKey.set(rateLimitingKey, taskDefinition.rateLimit.rules);
  }

  return rulesByKey;
}

export async function rateLimiterMiddleware(
  input: SchedulerMiddlewareFlow,
  rateLimiter: RateLimiter
): Promise<SchedulerMiddlewareFlow> {
  const accepted: (WaitingTask | DelayedTask)[] = [];
  const rejected: (WaitingTask | DelayedTask)[] = [];

  for (const task of input.acceptingTasks) {
    const taskDefinition = getTaskDefinition(task, input.taskMap);

    if (!taskDefinition.rateLimit) {
      accepted.push(task);
      continue;
    }

    const rateLimitingKey =
      taskDefinition.rateLimit.getRateLimitingKey?.() ?? task.name;

    // eventually return outcome with time to save as delayed
    const canSpendAmount = await rateLimiter.spendAmount(rateLimitingKey, 1);

    if (!canSpendAmount) {
      rejected.push(task);

      continue;
    }

    accepted.push(task);
  }

  return {
    taskMap: input.taskMap,
    acceptingTasks: accepted,
    rejectingTasks: rejected,
    processingTasks: input.processingTasks,
    assignedTasks: input.assignedTasks,
  };
}
