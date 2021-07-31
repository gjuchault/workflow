import { createPool, sql } from "slonik";

import { postgresConnectionUri } from "./config";

export async function clear({
  onlyClearSchedulers,
}: {
  onlyClearSchedulers: boolean;
}) {
  const pool = await createPool(postgresConnectionUri);

  if (onlyClearSchedulers) {
    pool.query(sql`
      delete from workflow.schedulers;
    `);
  } else {
    pool.query(sql`
      drop table workflow.flow_tasks;
      drop table workflow.flow_tasks_groups;
      drop table workflow.flows;
      drop table workflow.tasks_events;
      drop table workflow.schedulers;
      drop table workflow.tasks;
      drop table workflow.workers;
      drop table workflow.rate_limiting;
    `);
  }
}

if (require.main === module) {
  clear({ onlyClearSchedulers: true });
}
