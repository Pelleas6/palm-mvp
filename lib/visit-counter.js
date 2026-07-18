const DEFAULT_NAMESPACE = "le-pouls-du-monde-pelleas6";
const DEFAULT_COUNTER = "explorations";

function countFromPayload(payload) {
  const candidates = [payload?.count, payload?.data?.count, payload?.value];
  return candidates.find((value) => Number.isFinite(value)) ?? null;
}

function counterConfig(env) {
  const workspace = env.COUNTER_API_WORKSPACE;
  const apiKey = env.COUNTER_API_KEY;
  const counter = env.COUNTER_API_COUNTER || DEFAULT_COUNTER;

  if (workspace && apiKey) {
    return {
      baseUrl: `https://api.counterapi.dev/v2/${encodeURIComponent(workspace)}/${encodeURIComponent(counter)}`,
      headers: { Authorization: `Bearer ${apiKey}` },
    };
  }

  const namespace = env.COUNTER_API_NAMESPACE || DEFAULT_NAMESPACE;
  return {
    baseUrl: `https://api.counterapi.dev/v1/${encodeURIComponent(namespace)}/${encodeURIComponent(counter)}`,
    headers: {},
  };
}

export async function getVisitCount({ increment = false, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = counterConfig(env);
  const endpoint = increment ? `${config.baseUrl}/up` : config.baseUrl;

  try {
    const response = await fetchImpl(endpoint, {
      headers: config.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    const payload = await response.json().catch(() => null);
    const count = countFromPayload(payload);

    if (!response.ok || !Number.isFinite(count)) return { ok: false, count: null };
    return { ok: true, count };
  } catch {
    return { ok: false, count: null };
  }
}
