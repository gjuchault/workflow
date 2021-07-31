import { sql } from 'slonik';

import { CreateTableDependencies } from './createTable';

export async function createRateLimitingsTables({
  i,
  trx,
}: CreateTableDependencies) {
  await trx.query(sql`
    create table if not exists ${i('rate_limiting')} (
      "rate_limiting_key" varchar     not null,
      "rule_name"         varchar     not null,
      "amount"            int4        not null,
      "interval_start"    timestamptz not null,
      primary key ("rate_limiting_key" , "rule_name")
    )
  `);
}
