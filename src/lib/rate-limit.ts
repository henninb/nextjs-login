/**
 * Process-local fixed-window limiter. For multiple Node workers or serverless isolates,
 * use a shared store (e.g. Redis / Upstash) so limits apply across instances.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true };
}

/**
 * Client IP for rate limiting. Prefer platform-set headers; only trust
 * X-Forwarded-For when TRUST_PROXY=1 or in development (see comments in code).
 */
export function getClientKey(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    return vercel.split(",")[0]?.trim() || "unknown";
  }
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) {
    return cf.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (
      process.env.TRUST_PROXY === "1" ||
      process.env.NODE_ENV === "development"
    ) {
      return first || "unknown";
    }
  }
  return "unknown";
}
