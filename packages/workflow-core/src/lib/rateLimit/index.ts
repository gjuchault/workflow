import { debug } from 'debug';

const log = debug('workflow:rateLimit');

type RateLimiterDependencies = {
  readonly rulesByKey: Map<string, RateLimitingRule[]>;
  readonly onSaveBuckets: (
    buckets: Map<string, Map<string, Bucket>>
  ) => Promise<void>;
  readonly initialBucketsByRateLimitingKey?: Map<string, Map<string, Bucket>>;
};

export type RateLimiter = {
  readonly spendAmount: (
    rateLimitingKey: string,
    amount: number,
    date?: number
  ) => Promise<boolean>;
};

export type RateLimitingRule = {
  /**
   * Unique name of the rate limit rule
   */
  readonly id: string;

  /**
   * Initial amount of tasks allowed to be executed
   */
  readonly initialAmount: number;

  /**
   * Controls how often the current amount value should be increased in ms
   */
  readonly restoreEvery: number;

  /**
   * Controls how much the current amount value should be increased when
   * restoreEvery is hit
   */
  readonly amountRestored: number;
};

export type Bucket = {
  amount: number;
  intervalStart: number;
};

export function buildRateLimiter({
  rulesByKey,
  onSaveBuckets,
  initialBucketsByRateLimitingKey = new Map(),
}: RateLimiterDependencies): RateLimiter {
  // shallow copy initial map
  const bucketsByRateLimitingKey = new Map(
    Array.from(
      initialBucketsByRateLimitingKey
    ).map(([rateLimitingKey, buckets]) => [rateLimitingKey, new Map(buckets)])
  );

  async function ensureDefaultBucket(rateLimitingKey: string, now: number) {
    const existingBucket = bucketsByRateLimitingKey.get(rateLimitingKey);

    if (existingBucket) {
      return existingBucket;
    }

    const rules = rulesByKey.get(rateLimitingKey);

    if (!rules) {
      throw new TypeError(
        `Expected rules to be defined for key ${rateLimitingKey}`
      );
    }

    const buckets = new Map<string, Bucket>();
    for (const rule of rules) {
      buckets.set(rule.id, {
        amount: rule.initialAmount,
        intervalStart: now,
      });
    }

    bucketsByRateLimitingKey.set(rateLimitingKey, buckets);

    await onSaveBuckets(bucketsByRateLimitingKey);

    return buckets;
  }

  async function spendAmount(
    rateLimitingKey: string,
    amount: number,
    now: number = Date.now()
  ): Promise<boolean> {
    const rules = rulesByKey.get(rateLimitingKey);

    if (!rules) {
      throw new TypeError(
        `Expected rules to be defined for key ${rateLimitingKey}`
      );
    }

    const scopedBuckets = await ensureDefaultBucket(rateLimitingKey, now);

    log(`Trying to spend ${amount} for ${rateLimitingKey}`);
    for (const rule of rules) {
      let bucket = scopedBuckets.get(rule.id);

      if (!bucket) {
        throw new TypeError(
          'Expected ensureDefaultBucket to have created the bucket'
        );
      }

      if (bucket.intervalStart + rule.restoreEvery < now) {
        // multiply amountRestored by restoreEvery diff between intervalStart and
        // now, and let regular case handle it by default
        const numberOfIntervalPassed = Math.floor(
          (now - bucket.intervalStart) / rule.restoreEvery
        );

        log(
          `restoring ${numberOfIntervalPassed} * ${rule.amountRestored} to ${rateLimitingKey}/${rule.id}`
        );

        bucket = {
          amount: Math.min(
            rule.initialAmount,
            bucket.amount + rule.amountRestored * numberOfIntervalPassed
          ),
          intervalStart: now,
        };

        scopedBuckets.set(rule.id, bucket);
      }

      const nextAmount = bucket.amount - amount;

      if (nextAmount < 0) {
        log(
          `rate limiting blocking: ${amount} > ${bucket.amount} for ${rateLimitingKey}/${rule.id}`
        );

        return false;
      }

      log(
        `rate limiting passed, next amount: ${nextAmount} for ${rateLimitingKey}/${rule.id}`
      );

      scopedBuckets.set(rule.id, {
        amount: nextAmount,
        intervalStart: bucket.intervalStart,
      });
    }

    await onSaveBuckets(bucketsByRateLimitingKey);

    return true;
  }

  return { spendAmount };
}

export function reshapeBucketsToStringifiableShape(
  bucketsByRateLimitingKey: Map<string, Map<string, Bucket>>
): Record<string, Record<string, Bucket>> {
  return Object.fromEntries(
    Array.from(bucketsByRateLimitingKey).map(([rateLimitingKey, buckets]) => [
      rateLimitingKey,
      Object.fromEntries(buckets),
    ])
  );
}
