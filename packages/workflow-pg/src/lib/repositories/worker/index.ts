import type { Storage, Worker } from '@workflow/core';
import { sql } from 'slonik';

import { getDateIn } from '../../helpers/getDateIn';
import { prepareBulkInsert } from '../../helpers/slonik';
import { Repository } from '../repository';

export function buildWorkerRepository({
  i,
  ttlInMinutes,
  pool,
}: Repository): Pick<Storage, 'refreshWorkersLocks' | 'registerWorkers'> {
  async function refreshWorkersLocks(workerIds: readonly string[]) {
    await pool.query(sql`
      update ${i('workers')}
        set "ttl" = current_timestamp + (${ttlInMinutes} * interval '1 minute')
      where "id" = any(${sql.array(workerIds, 'text')})
    `);
  }

  async function registerWorkers(workers: readonly Pick<Worker, 'id'>[]) {
    if (workers.length === 0) {
      return;
    }

    const { columns, rows } = prepareBulkInsert(
      [
        ['id', 'text'],
        ['ttl', 'timestamptz'],
      ],
      workers,
      (worker) => ({
        id: worker.id,
        ttl: getDateIn(new Date(), ttlInMinutes),
      })
    );

    await pool.query(sql`
      insert into ${i('workers')} (${columns})
      select * from ${rows}
    `);
  }

  return {
    refreshWorkersLocks,
    registerWorkers,
  };
}
