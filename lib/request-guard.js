const buckets = new Map();
const MAX_BUCKETS = 2_000;

function clientKey(request) {
  const forwarded = request?.headers?.get?.("x-forwarded-for") || "";
  const realIp = request?.headers?.get?.("x-real-ip") || "";
  const candidate = (forwarded.split(",")[0] || realIp || "anonymous").trim();
  // La clé ne sert qu'en mémoire pour lisser une rafale ; elle n'est ni loggée
  // ni renvoyée au navigateur.
  return candidate.slice(0, 96) || "anonymous";
}

function prune(now) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now || buckets.size >= MAX_BUCKETS) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS) break;
  }
}

export function guardRequest(request, {
  scope = "default",
  limit = 60,
  windowMs = 60_000,
  now = Date.now(),
} = {}) {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowMs = Math.max(1_000, Math.floor(windowMs));
  prune(now);

  const key = `${scope}:${clientKey(request)}`;
  const previous = buckets.get(key);
  const entry = previous && previous.resetAt > now
    ? previous
    : { count: 0, resetAt: now + safeWindowMs };

  if (entry.count >= safeLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
    return {
      allowed: false,
      limit: safeLimit,
      remaining: 0,
      retryAfterSeconds,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  buckets.set(key, entry);
  return {
    allowed: true,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - entry.count),
    retryAfterSeconds: 0,
    resetAt: entry.resetAt,
  };
}

export function rateLimitHeaders(result) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
  };
}

export function resetRequestGuardsForTests() {
  buckets.clear();
}
