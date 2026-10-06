export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const buckets = new Map<string, Bucket>();

/**
 * Public check endpoint. The GitHub Action calls about twice an hour.
 * 10/hour/IP leaves room for a manual test and a retry, and stops a loop
 * from calling Vodafone on one warm instance. Invalid configuration fails closed.
 */
export function consumeCheckRateLimit(key: string, now = Date.now()): RateLimitDecision {
  const limit = readHourlyLimit();
  if (limit === null) {
    return { allowed: false, retryAfterSeconds: 60 };
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true };
}

function readHourlyLimit(): number | null {
  const raw = process.env.RATE_LIMIT_CHECK_PER_HOUR;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    return null;
  }
  return parsed;
}
