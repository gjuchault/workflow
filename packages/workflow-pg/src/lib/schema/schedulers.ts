import { sql } from 'slonik';

import { CreateTableDependencies } from './createTable';

export async function createSchedulersTables({
  i,
  trx,
}: CreateTableDependencies) {
  await trx.query(sql`
    create table if not exists ${i('schedulers')} (
      "id"        varchar     not null,
      "is_master" boolean     default null,
      "ttl"       timestamptz not null,
      primary key ("id"),
      constraint  "schedulers__is_master__unique" unique ("is_master")
    )
  `);
}
