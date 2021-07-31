import { Task } from '@workflow/core';

export type DatabaseTask = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  state: string;
  error?: Record<string, unknown>;
  worker_id?: string;
  queued_at: number;
  process_at?: number;
};

export function encodeTask(databaseTask: DatabaseTask): Task {
  return {
    id: databaseTask.id,
    name: databaseTask.name,
    input: databaseTask.input,
    state: databaseTask.state,
    error: databaseTask.error,
    workerId: databaseTask.worker_id,
    queuedAt: new Date(databaseTask.queued_at),
    processAt: databaseTask.process_at
      ? new Date(databaseTask.process_at)
      : undefined,
  } as Task;
}
