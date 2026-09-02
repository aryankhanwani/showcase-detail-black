/**
 * A deliberately small in-process rate limiter.
 *
 * This is a single-instance showcase site, so a Map is the honest choice —
 * pulling in Redis to throttle a demo contact form would be more moving parts
 * than the thing it protects. On more than one instance this becomes
 * per-instance rather than global, which is the point at which it should be
 * swapped for a shared store.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/* Bounded so a flood of unique keys cannot grow the map without limit. */
const MAX_KEYS = 5000;

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client key. Behind a proxy, x-forwarded-for is the real address. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
