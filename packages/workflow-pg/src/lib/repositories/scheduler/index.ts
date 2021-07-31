import type { Scheduler, Storage } from '@workflow/core';
import { sql } from 'slonik';

import { getDateIn } from '../../helpers/getDateIn';
import { prepareBulkInsert } from '../../helpers/slonik';
import { Repository } from '../repository';

export function buildSchedulerRepository({
  i,
  ttlInMinutes,
  pool,
}: Repository): Pick<
  Storage,
  | 'resignDeadLeaders'
  | 'refreshSchedulersLocks'
  | 'tryToSetMasterScheduler'
  | 'registerSchedulers'
  | 'unregisterSchedulers'
> {
  async function resignDeadLeaders(): Promise<number> {
    const { rowCount } = await pool.query(sql`
      update ${i('schedulers')}
        set "is_master" = null
      where
        "is_master" = true
        and current_timestamp > "ttl"
    `);

    return rowCount;
  }

  async function refreshSchedulersLocks(schedulerIds: readonly string[]) {
    await pool.query(sql`
      update ${i('schedulers')}
        set ttl = current_timestamp + (${ttlInMinutes} * interval '1 minute')
      where id = any(${sql.array(schedulerIds, 'text')})
    `);
  }

  async function tryToSetMasterScheduler(
    masterSchedulerId: string
  ): Promise<boolean> {
    try {
      await pool.query(sql`
        update ${i('schedulers')}
          set "is_master" = true
        where "id" = ${masterSchedulerId}
      `);

      return true;
    } catch (err) {
      return false;
    }
  }

  async function registerSchedulers(
    schedulers: readonly Pick<Scheduler, 'id'>[]
  ): Promise<void> {
    if (schedulers.length === 0) {
      return;
    }

    const { columns, rows } = prepareBulkInsert(
      [
        ['id', 'text'],
        ['ttl', 'timestamptz'],
      ],
      schedulers,
      (scheduler) => ({
        id: scheduler.id,
        ttl: getDateIn(new Date(), ttlInMinutes),
      })
    );

    await pool.query(sql`
      insert into ${i('schedulers')} (${columns})
      select * from ${rows}
    `);
  }

  async function unregisterSchedulers(schedulerIds: readonly string[]) {
    await pool.query(sql`
      delete from ${i('schedulers')}
      where "id" = any(${sql.array(schedulerIds, 'text')})
    `);
  }

  return {
    resignDeadLeaders,
    refreshSchedulersLocks,
    tryToSetMasterScheduler,
    registerSchedulers,
    unregisterSchedulers,
  };
}
