/**
 * Retries for transient R2 failures.
 *
 * R2 sometimes throws "We encountered an internal error. Please try again.
 * (10001)". A missing object is not an error (get/head return null), so any
 * thrown error is treated as transient and retried with backoff.
 */

export interface RetryOptions {
  /** Total attempts, including the first. Default 4. */
  attempts?: number;
  /** Delay before the first retry. Later retries back off by 4x. Default 250 ms. */
  baseDelayMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Called once per retry. Default console.warn. */
  log?: (message: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Run `fn`, retrying when it throws. Rethrows the last error. */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 4);
  const baseDelayMs = options.baseDelayMs ?? 250;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? ((message: string) => console.warn(message));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = baseDelayMs * 4 ** (attempt - 1);
      log(`[R2 RETRY] ${label} failed (attempt ${attempt}/${attempts}): ${errorMessage(error)}; retrying in ${delay} ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}

const RETRIED_METHODS = new Set(['get', 'head', 'list', 'put']);

/** A stream body is consumed by the first attempt, so it cannot be sent again. */
function isReplayable(body: unknown): boolean {
  return !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream);
}

/**
 * Wrap an R2 bucket binding so get, head, list, and put retry on thrown
 * errors. Other methods (including delete) pass through unchanged.
 */
export function retryingBucket<B extends object>(bucket: B, options: RetryOptions = {}): B {
  return new Proxy(bucket, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string' || typeof value !== 'function' || !RETRIED_METHODS.has(prop)) {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (...args: unknown[]) => {
        const call = () => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        if (prop === 'put' && !isReplayable(args[1])) return call();
        const key = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0] ?? {});
        return withRetry(`${prop} ${key}`, call, options);
      };
    },
  });
}
