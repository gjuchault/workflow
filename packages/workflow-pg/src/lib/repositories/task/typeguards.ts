import type {
  AssignedTask,
  DelayedTask,
  ProcessingTask,
  Task,
  WaitingTask,
} from '@workflow/core';

import { JsonPrimitive } from '../../helpers/slonik';
import { rejectUnexpectedValue } from '../../helpers/switchGuard';

export function getTaskError(task: Task): string | null {
  switch (task.state) {
    case 'failed':
      return JSON.stringify(task.error);
    case 'assigned':
    case 'done':
    case 'processing':
    case 'waiting':
    case 'delayed':
      return null;
    default:
      return rejectUnexpectedValue('task.state', task);
  }
}

export function getTaskWorkerId(task: Task): string | null {
  switch (task.state) {
    case 'assigned':
    case 'processing':
      return task.workerId;
    case 'failed':
    case 'done':
    case 'waiting':
    case 'delayed':
      return null;
    default:
      return rejectUnexpectedValue('task.state', task);
  }
}

export function getTaskOutput(task: Task): JsonPrimitive {
  switch (task.state) {
    case 'done':
      if (!task.output) {
        return null;
      }

      return task.output as JsonPrimitive;
    case 'assigned':
    case 'processing':
    case 'failed':
    case 'waiting':
    case 'delayed':
      return null;
    default:
      return rejectUnexpectedValue('task.state', task);
  }
}

export function getTaskProcessAt(task: Task): string | null {
  switch (task.state) {
    case 'assigned':
    case 'processing':
    case 'failed':
    case 'done':
    case 'waiting':
      return null;
    case 'delayed':
      return task.processAt.toISOString();
    default:
      return rejectUnexpectedValue('task.state', task);
  }
}

export function getTaskEventPayload(task: Task): JsonPrimitive {
  switch (task.state) {
    case 'assigned':
      return { workerId: task.workerId };
    case 'delayed':
      return {
        taskName: task.name,
        input: task.input as JsonPrimitive,
        processAt: task.processAt,
      };
    case 'done':
      if (!task.output) {
        return {};
      }
      return task.output as JsonPrimitive;
    case 'failed':
      return { error: task.error as JsonPrimitive };
    case 'processing':
      return {};
    case 'waiting':
      return { taskName: task.name, input: task.input as JsonPrimitive };
    default:
      rejectUnexpectedValue('task.state', task);
  }
}

export function ensureWaitingOrDelayedTask(
  task: Task
): WaitingTask | DelayedTask {
  switch (task.state) {
    case 'waiting':
    case 'delayed':
      return task;
    case 'assigned':
    case 'done':
    case 'failed':
    case 'processing':
      throw new Error(`Expected waiting or delayed task, got ${task.state}`);
    default:
      rejectUnexpectedValue('task.state', task);
  }
}

export function ensureProcessingTask(task: Task): ProcessingTask {
  switch (task.state) {
    case 'processing':
      return task;
    case 'waiting':
    case 'delayed':
    case 'assigned':
    case 'done':
    case 'failed':
      throw new Error(`Expected processing task, got ${task.state}`);
    default:
      rejectUnexpectedValue('task.state', task);
  }
}

export function ensureAssignedTask(task: Task): AssignedTask {
  switch (task.state) {
    case 'assigned':
      return task;
    case 'waiting':
    case 'delayed':
    case 'processing':
    case 'done':
    case 'failed':
      throw new Error(`Expected assigned task, got ${task.state}`);
    default:
      rejectUnexpectedValue('task.state', task);
  }
}
