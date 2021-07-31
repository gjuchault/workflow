import type { Bucket } from '@workflow/core';

export type DatabaseRateLimitingRow = {
  task_id: string;
  rate_limiting_key: string;
  rule_name: string;
  amount: number;
  interval_start: number;
};

export function decodeRateLimiter(rows: readonly DatabaseRateLimitingRow[]) {
  const bucketsByRateLimitingKey: Map<string, Map<string, Bucket>> = new Map();

  for (const row of rows) {
    const existingScopedBucket = bucketsByRateLimitingKey.get(
      row.rate_limiting_key
    );

    if (!existingScopedBucket) {
      bucketsByRateLimitingKey.set(
        row.rate_limiting_key,
        new Map([
          [
            row.rule_name,
            { amount: row.amount, intervalStart: row.interval_start },
          ],
        ])
      );

      continue;
    }

    existingScopedBucket.set(row.rule_name, {
      amount: row.amount,
      intervalStart: row.interval_start,
    });

    bucketsByRateLimitingKey.set(row.rate_limiting_key, existingScopedBucket);
  }

  return bucketsByRateLimitingKey;
}

type FlattenedRateLimitingRow = {
  rateLimitingKey: string;
  ruleName: string;
  amount: number;
  intervalStart: number;
};

export function flattenRateLimiting(
  bucketsByRateLimitingKey: Map<string, Map<string, Bucket>>
): FlattenedRateLimitingRow[] {
  const rows: FlattenedRateLimitingRow[] = [];

  for (const [rateLimitingKey, scopedBucket] of bucketsByRateLimitingKey) {
    for (const [ruleName, bucket] of scopedBucket) {
      rows.push({
        rateLimitingKey: rateLimitingKey,
        ruleName: ruleName,
        amount: bucket.amount,
        intervalStart: bucket.intervalStart,
      });
    }
  }

  return rows;
}
