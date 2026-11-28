import test from 'ava';
import { retryingBucket, withRetry } from '../src/r2-retry.ts';

const noSleep = { sleep: async () => {}, log: () => {} };

test('withRetry returns after transient failures', async t => {
  let calls = 0;
  const value = await withRetry('op', async () => {
    calls++;
    if (calls < 3) throw new Error('We encountered an internal error. Please try again. (10001)');
    return 'ok';
  }, noSleep);
  t.is(value, 'ok');
  t.is(calls, 3);
});

test('withRetry rethrows the last error after all attempts', async t => {
  let calls = 0;
  const error = await t.throwsAsync(() => withRetry('op', async () => {
    calls++;
    throw new Error(`fail ${calls}`);
  }, { ...noSleep, attempts: 3 }));
  t.is(error?.message, 'fail 3');
  t.is(calls, 3);
});

test('withRetry backs off by 4x from the base delay', async t => {
  const delays: number[] = [];
  await t.throwsAsync(() => withRetry('op', async () => { throw new Error('x'); }, {
    attempts: 4, baseDelayMs: 250, log: () => {}, sleep: async ms => { delays.push(ms); },
  }));
  t.deepEqual(delays, [250, 1000, 4000]);
});

function fakeBucket(failures: number) {
  const calls: Record<string, number> = {};
  const track = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
    if (calls[name] <= failures) throw new Error('internal error (10001)');
  };
  return {
    calls,
    bucket: {
      async get(key: string) { track('get'); return key === 'missing' ? null : { key }; },
      async put(key: string, _body: unknown) { track('put'); return { key }; },
      async list(_opts: unknown) { track('list'); return { objects: [] }; },
      async delete(_key: string) { track('delete'); },
    },
  };
}

test('retryingBucket retries get, put, and list', async t => {
  const { bucket, calls } = fakeBucket(2);
  const r2 = retryingBucket(bucket, noSleep);
  t.deepEqual(await r2.get('a'), { key: 'a' });
  t.deepEqual(await r2.put('b', 'body'), { key: 'b' });
  t.deepEqual(await r2.list({ prefix: 'raw/' }), { objects: [] });
  t.is(calls.get, 3);
  t.is(calls.put, 3);
  t.is(calls.list, 3);
});

test('retryingBucket treats a missing object as a result, not an error', async t => {
  const { bucket, calls } = fakeBucket(0);
  t.is(await retryingBucket(bucket, noSleep).get('missing'), null);
  t.is(calls.get, 1);
});

test('retryingBucket does not retry delete', async t => {
  const { bucket, calls } = fakeBucket(1);
  await t.throwsAsync(() => retryingBucket(bucket, noSleep).delete('a'));
  t.is(calls.delete, 1);
});

test('retryingBucket does not retry a put with a stream body', async t => {
  const { bucket, calls } = fakeBucket(1);
  const stream = new ReadableStream();
  await t.throwsAsync(() => retryingBucket(bucket, noSleep).put('a', stream));
  t.is(calls.put, 1);
});
