import type { Bucket, Storage } from '@workflow/core';
import { sql } from 'slonik';

import { prepareBulkInsert } from '../../helpers/slonik';
import { Repository } from '../repository';

import {
  DatabaseRateLimitingRow,
  decodeRateLimiter,
  flattenRateLimiting,
} from './codec';

export function buildRateLimitingRepository({
  i,
  pool,
}: Repository): Pick<Storage, 'getRateLimiting' | 'setRateLimiting'> {
  async function getRateLimiting(): Promise<Map<string, Map<string, Bucket>>> {
    const rows = await pool.any<DatabaseRateLimitingRow>(sql`
      select * from ${i('rate_limiting')}
    `);

    return decodeRateLimiter(rows);
  }

  async function setRateLimiting(
    bucketsByRateLimitingKey: Map<string, Map<string, Bucket>>
  ): Promise<void> {
    if (bucketsByRateLimitingKey.size === 0) {
      return;
    }

    const { rows, columns } = prepareBulkInsert(
      [
        ['rate_limiting_key', 'text'],
        ['rule_name', 'text'],
        ['amount', 'int4'],
        ['interval_start', 'timestamptz'],
      ],
      flattenRateLimiting(bucketsByRateLimitingKey),
      ({ rateLimitingKey, ruleName, amount, intervalStart }) => ({
        rate_limiting_key: rateLimitingKey,
        rule_name: ruleName,
        amount: amount,
        interval_start: new Date(intervalStart).toISOString(),
      })
    );

    await pool.query(sql`
      insert into ${i('rate_limiting')} (${columns})
      select * from ${rows}
      on conflict ("rate_limiting_key", "rule_name") do update
        set amount = excluded.amount,
            interval_start = excluded.interval_start;
    `);
  }

  return {
    getRateLimiting,
    setRateLimiting,
  };
}
