import { DatabasePoolType, IdentifierSqlTokenType, sql } from 'slonik';

import { createFlowsTables } from './flows';
import { createRateLimitingsTables } from './rateLimitings';
import { createSchedulersTables } from './schedulers';
import { createTasksTables } from './tasks';
import { createWorkersTables } from './workers';

export type CreateSchemaDependencies = {
  schema: string;
  pool: DatabasePoolType;
  i: (table: string) => IdentifierSqlTokenType;
};

export async function createSchema({
  pool,
  schema,
  i,
}: CreateSchemaDependencies): Promise<void> {
  await pool.transaction(async (trx) => {
    await trx.query(
      sql`create schema if not exists ${sql.identifier([schema])}`
    );

    await createSchedulersTables({ i, trx });
    await createWorkersTables({ i, trx });
    await createRateLimitingsTables({ i, trx });
    await createTasksTables({ i, trx });
    await createFlowsTables({ i, trx });
  });
}
