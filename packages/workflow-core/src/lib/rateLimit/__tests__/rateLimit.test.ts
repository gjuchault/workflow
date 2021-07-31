import test from 'ava';

import { Bucket, buildRateLimiter } from '../';

test('nominal case', async (t) => {
  const storage: { buckets: Map<string, Map<string, Bucket>> } = {
    buckets: new Map(),
  };

  const rateLimiter = buildRateLimiter({
    rulesByKey: new Map([
      [
        'key',
        [
          {
            id: 'rule-1',
            initialAmount: 10,
            amountRestored: 10,
            restoreEvery: 100,
          },
        ],
      ],
      [
        'key2',
        [
          {
            id: 'rule-2',
            initialAmount: 10,
            amountRestored: 10,
            restoreEvery: 100,
          },
        ],
      ],
    ]),
    async onSaveBuckets(buckets) {
      storage.buckets = buckets;
    },
  });

  const initialDate = Date.now();

  t.is(
    await rateLimiter.spendAmount('key', 3, initialDate),
    true,
    'Allowed to spend 3'
  );
  t.is(storage.buckets.get('key')?.get('rule-1')?.amount, 7, 'Bucket is now 7');

  t.is(
    await rateLimiter.spendAmount('key', 7, initialDate),
    true,
    'Allowed to spend 7'
  );
  t.is(storage.buckets.get('key')?.get('rule-1')?.amount, 0, 'Bucket is now 0');

  t.is(
    await rateLimiter.spendAmount('key', 1, initialDate),
    false,
    'Not allowed to spend'
  );
  t.is(
    await rateLimiter.spendAmount('key2', 1, initialDate),
    true,
    'Allowed to spend on a different key'
  );

  t.is(
    await rateLimiter.spendAmount('key', 1, initialDate + 110),
    true,
    'Allowed to spend after period'
  );
  t.is(storage.buckets.get('key')?.get('rule-1')?.amount, 9, 'Bucket is now 9');
});

test('initial buckets', (t) => {
  t.is(1, 1, 'ok');
});
