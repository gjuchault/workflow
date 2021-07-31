import { sql } from 'slonik';

import { CreateTableDependencies } from './createTable';

export async function createWorkersTables({ i, trx }: CreateTableDependencies) {
  await trx.query(sql`
    create table if not exists ${i('workers')} (
      "id"  varchar     not null,
      "ttl" timestamptz not null,
      primary key ("id")
    )
  `);
}
