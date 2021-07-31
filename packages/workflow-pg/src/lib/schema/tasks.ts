import { sql } from 'slonik';

import { CreateTableDependencies } from './createTable';

export async function createTasksTables({ i, trx }: CreateTableDependencies) {
  await trx.query(sql`
    create table if not exists ${i('tasks')} (
      "id"           uuid        not null,
      "name"         varchar     not null,
      "input"        jsonb       not null,
      "output"       jsonb,
      "state"        varchar     not null,
      "error"        jsonb,
      "worker_id"    varchar     references ${i('workers')} ("id"),
      "queued_at"    timestamptz not null,
      "process_at"   timestamptz,
      primary key ("id")
    );
  `);

  await trx.query(sql`
    create table if not exists ${i('tasks_events')} (
      "id"         uuid        not null,
      "task_id"    uuid        not null references ${i('tasks')} ("id"),
      "event"      varchar     not null,
      "payload"    jsonb,
      "emitted_at" timestamptz not null,
      primary key ("id")
    )
  `);
}
