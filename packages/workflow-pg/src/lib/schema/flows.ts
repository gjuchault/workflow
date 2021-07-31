import { sql } from 'slonik';

import { CreateTableDependencies } from './createTable';

export async function createFlowsTables({ i, trx }: CreateTableDependencies) {
  await trx.query(sql`
    create table if not exists ${i('flows')} (
      "id"         uuid    not null,
      "name"       varchar not null,
      "input"      varchar not null,
      "created_at" timestamptz not null default now(),
      "done_at"    timestamptz,
      primary key ("id")
    )
  `);

  await trx.query(sql`
    create table if not exists ${i('flow_tasks')} (
      "task_id"      uuid references ${i('tasks')} ("id"),
      "flow_id"      uuid references ${i('flows')} ("id"),
      "is_task_done" boolean default false,
      primary key ("task_id")
    )
  `);

  await trx.query(sql`
    create table if not exists ${i('flow_tasks_groups')} (
      "task_id"      uuid references ${i('tasks')} ("id"),
      "flow_id"      uuid references ${i('flows')} ("id"),
      "group_id"     uuid,
      "is_task_done" boolean default false,
      primary key ("task_id")
    )
  `);
}
