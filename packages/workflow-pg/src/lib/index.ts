import type { Storage } from '@workflow/core';
import { createPool, IdentifierSqlTokenType, sql } from 'slonik';

import { buildFlowRepository } from './repositories/flow';
import { buildRateLimitingRepository } from './repositories/rateLimiting';
import { buildSchedulerRepository } from './repositories/scheduler';
import { buildTaskRepository } from './repositories/task';
import { buildWorkerRepository } from './repositories/worker';
import { createSchema } from './schema';

export type StorageDependencies = {
  connectionUri: string;
  schema: string;
  ttlInMinutes?: number;
};

export async function createWorkflowStorage({
  connectionUri,
  schema = 'public',
  ttlInMinutes = 2,
}: StorageDependencies): Promise<Storage> {
  const pool = createPool(connectionUri);

  function i(table: string): IdentifierSqlTokenType {
    return sql.identifier([schema, table]);
  }

  const dependencies = {
    pool,
    schema,
    i,
    ttlInMinutes,
  };

  await createSchema(dependencies);

  const flowsRepository = buildFlowRepository(dependencies);
  const rateLimitingsRepository = buildRateLimitingRepository(dependencies);
  const schedulersRepositories = buildSchedulerRepository(dependencies);
  const tasksRepositories = buildTaskRepository(dependencies);
  const workersRepositories = buildWorkerRepository(dependencies);

  return {
    stop: pool.end,

    ...flowsRepository,
    ...rateLimitingsRepository,
    ...schedulersRepositories,
    ...tasksRepositories,
    ...workersRepositories,
  };
}
