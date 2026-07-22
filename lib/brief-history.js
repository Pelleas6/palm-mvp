const MAX_TEXT = 600;
const MAX_URL = 1_800;
const MAX_BATCH = 120;

function text(value, max = MAX_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeIso(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    return url.toString().slice(0, MAX_URL);
  } catch {
    return null;
  }
}

function clampNumber(value, min = 0, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 0;
}

function isLocalized(article) {
  return Boolean(text(article?.eventCountryIso, 8) && text(article?.eventCountry, 100));
}

function articleKey(article, index) {
  return safeUrl(article?.url) || text(article?.id, 140) || `sans-url-${index}`;
}

function isConfiguredValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getBriefHistoryConfig(env = process.env) {
  const supabaseUrl = text(env?.SUPABASE_URL, MAX_URL).replace(/\/+$/, "");
  const serviceRoleKey = text(env?.SUPABASE_SERVICE_ROLE_KEY, 4_000);
  const ingestSecret = text(env?.WORLD_PULSE_INGEST_SECRET, 4_000);
  return {
    supabaseUrl,
    serviceRoleKey,
    ingestSecret,
    storageConfigured: isConfiguredValue(supabaseUrl) && isConfiguredValue(serviceRoleKey),
    ingestConfigured: isConfiguredValue(supabaseUrl) && isConfiguredValue(serviceRoleKey) && isConfiguredValue(ingestSecret),
  };
}

export function briefHistoryReadiness(env = process.env) {
  const config = getBriefHistoryConfig(env);
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.ingestSecret) missing.push("WORLD_PULSE_INGEST_SECRET");
  return {
    state: missing.length === 0 ? "ready" : "configuration_required",
    provider: "Supabase Postgres",
    missing,
    schema: "supabase/migrations/20260720_world_pulse_history.sql",
  };
}

export function requestHasHistoryAccess(request, env = process.env) {
  const secret = getBriefHistoryConfig(env).ingestSecret;
  if (!secret) return false;
  const authorization = String(request?.headers?.get?.("authorization") || "");
  return authorization === `Bearer ${secret}`;
}

export function buildHistorySnapshot(payload, { collectedAt = null } = {}) {
  if (!payload || payload.state !== "ok" || payload?.source?.active !== "RSS_PUBLIC") {
    throw new Error("Le flux RSS public n'est pas dans un état enregistrable.");
  }
  const generatedAt = safeIso(payload.generatedAt);
  if (!generatedAt) throw new Error("Le flux ne fournit pas de date de génération valide.");

  const observedAt = safeIso(collectedAt) || generatedAt;
  const articlesByKey = new Map();
  for (const [index, article] of (Array.isArray(payload.articles) ? payload.articles : []).entries()) {
    const key = articleKey(article, index);
    if (articlesByKey.has(key)) continue;
    const localized = isLocalized(article);
    articlesByKey.set(key, {
      article_key: key,
      article_url: safeUrl(article?.url),
      title: text(article?.title, 280) || "Article sans titre",
      media_name: text(article?.mediaName || article?.domain, 120) || "Source non précisée",
      domain: text(article?.domain, 120) || null,
      source_country: text(article?.sourceCountry, 100) || null,
      source_region: text(article?.sourceRegion, 100) || null,
      language: text(article?.language, 80) || null,
      seen_at: safeIso(article?.seenAt),
      event_country: text(article?.eventCountry, 100) || null,
      // The signal table uses this field as part of its primary key. A Postgres\n      // default only applies when the column is omitted, not when an explicit null\n      // is sent, so unlocalised articles need a stable grouping sentinel.\n      event_country_iso: text(article?.eventCountryIso, 8).toUpperCase() || "UNLOCALIZED",
      category: text(article?.label, 120) || "Non déterminé",
      category_type: text(article?.labelType, 120) || "non déterminé",
      confidence: clampNumber(article?.confidence),
      localized,
      observed_at: observedAt,
    });
  }
  const articles = [...articlesByKey.values()];
  const localizedCount = articles.filter((article) => article.localized).length;

  const signalsByKey = new Map();
  for (const article of articles) {
    const key = [article.event_country_iso || "UNLOCALIZED", article.event_country || "À qualifier", article.category, article.category_type].join("|");
    const current = signalsByKey.get(key) || {
      event_country_iso: article.event_country_iso,
      event_country: article.event_country || "À qualifier",
      category: article.category,
      category_type: article.category_type,
      localized: article.localized,
      article_count: 0,
      observed_at: observedAt,
    };
    current.article_count += 1;
    signalsByKey.set(key, current);
  }

  const sourcesByName = new Map();
  for (const source of Array.isArray(payload.sourceHealth) ? payload.sourceHealth : []) {
    const sourceName = text(source?.source, 140);
    if (!sourceName || sourcesByName.has(sourceName)) continue;
    sourcesByName.set(sourceName, {
      source_name: sourceName,
      region: text(source?.region, 100) || null,
      source_url: safeUrl(source?.url),
      http_status: Number.isInteger(source?.http) ? source.http : null,
      state: text(source?.state, 80) || "UNKNOWN",
      article_count: Math.max(0, Math.floor(Number(source?.articles) || 0)),
      recent: Boolean(source?.recent),
      checked_at: safeIso(source?.checkedAt) || observedAt,
    });
  }

  return {
    run: {
      run_key: `rss-${generatedAt}`,
      generated_at: generatedAt,
      collected_at: observedAt,
      state: "ok",
      cache_status: text(payload?.cache?.status, 40) || "unknown",
      article_count: articles.length,
      localized_count: localizedCount,
      localization_rate: articles.length ? Number(((localizedCount / articles.length) * 100).toFixed(2)) : 0,
      media_count: new Set(articles.map((article) => article.media_name)).size,
      source_count: [...sourcesByName.values()].filter((source) => source.state === "OK").length,
      source_health: Array.isArray(payload.sourceHealth) ? payload.sourceHealth : [],
    },
    articles,
    signals: [...signalsByKey.values()],
    sources: [...sourcesByName.values()],
  };
}

function historyError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function supabaseRequest(config, path, { method = "GET", body = null, headers = {}, fetchImpl = globalThis.fetch } = {}) {
  if (!config.storageConfigured) throw historyError("Le stockage historique n'est pas configuré.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(`${config.supabaseUrl}/rest/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body == null ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    const data = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : null;
    if (!response.ok) {
      throw historyError(`Le stockage historique a répondu ${response.status}.`, response.status >= 500 ? 503 : 502);
    }
    return data;
  } catch (error) {
    if (error?.status) throw error;
    throw historyError("Le stockage historique est momentanément indisponible.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertRows(config, table, rows, conflictColumns, fetchImpl) {
  for (let index = 0; index < rows.length; index += MAX_BATCH) {
    const batch = rows.slice(index, index + MAX_BATCH);
    if (batch.length === 0) continue;
    await supabaseRequest(config, `/${table}?on_conflict=${encodeURIComponent(conflictColumns)}`, {
      method: "POST",
      body: batch,
      fetchImpl,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  }
}

export async function persistBriefHistorySnapshot(payload, { env = process.env, fetchImpl = globalThis.fetch, collectedAt = null } = {}) {
  const config = getBriefHistoryConfig(env);
  const snapshot = buildHistorySnapshot(payload, { collectedAt });
  const runs = await supabaseRequest(config, "/world_pulse_history_runs?on_conflict=run_key", {
    method: "POST",
    body: snapshot.run,
    fetchImpl,
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
  const run = Array.isArray(runs) ? runs[0] : null;
  if (!run?.id) throw historyError("Le stockage n'a pas retourné l'identifiant de l'instantané.", 503);

  await upsertRows(config, "world_pulse_history_articles", snapshot.articles.map((article) => ({ ...article, run_id: run.id })), "run_id,article_key", fetchImpl);
  await upsertRows(config, "world_pulse_history_signals", snapshot.signals.map((signal) => ({ ...signal, run_id: run.id })), "run_id,event_country_iso,event_country,category,category_type", fetchImpl);
  await upsertRows(config, "world_pulse_history_sources", snapshot.sources.map((source) => ({ ...source, run_id: run.id })), "run_id,source_name", fetchImpl);

  return {
    runKey: snapshot.run.run_key,
    collectedAt: snapshot.run.collected_at,
    articles: snapshot.articles.length,
    localized: snapshot.run.localized_count,
    sources: snapshot.sources.length,
  };
}

export function parseHistoryWindow(url, { now = new Date() } = {}) {
  const to = safeIso(url?.searchParams?.get?.("to")) || now.toISOString();
  const defaultFrom = new Date(Date.parse(to) - 7 * 24 * 60 * 60 * 1_000).toISOString();
  const from = safeIso(url?.searchParams?.get?.("from")) || defaultFrom;
  const duration = Date.parse(to) - Date.parse(from);
  if (duration <= 0 || duration > 14 * 24 * 60 * 60 * 1_000) {
    throw historyError("La période demandée doit être comprise entre 1 minute et 14 jours.", 400);
  }
  const requestedLimit = Number(url?.searchParams?.get?.("articles"));
  return { from, to, articleLimit: Number.isFinite(requestedLimit) ? Math.min(250, Math.max(20, Math.floor(requestedLimit))) : 160 };
}

export async function readBriefHistorySummary(window, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = getBriefHistoryConfig(env);
  const summary = await supabaseRequest(config, "/rpc/world_pulse_history_summary", {
    method: "POST",
    body: { p_from: window.from, p_to: window.to, p_article_limit: window.articleLimit },
    fetchImpl,
  });
  return { schemaVersion: "2026-07-20", ...summary };
}

export function buildBriefAudit(input = {}) {
  const slug = text(input.slug, 140);
  const gitSha = text(input.gitSha || input.git_sha, 64);
  const deploymentUrl = safeUrl(input.deploymentUrl || input.deployment_url);
  const status = text(input.status, 32);
  if (!/^[a-z0-9-]+$/.test(slug)) throw historyError("Le slug du brief est invalide.", 400);
  if (!/^[a-f0-9]{7,64}$/i.test(gitSha)) throw historyError("Le SHA Git est invalide.", 400);
  if (!deploymentUrl) throw historyError("L'URL de déploiement est invalide.", 400);
  if (status !== "published") throw historyError("Seule une publication vérifiée peut être auditée.", 400);
  return {
    slug,
    status,
    git_sha: gitSha,
    deployment_url: deploymentUrl,
    period_start: safeIso(input.periodStart || input.period_start),
    period_end: safeIso(input.periodEnd || input.period_end),
    article_count: Math.max(0, Math.floor(Number(input.articleCount || input.article_count) || 0)),
    localization_rate: clampNumber(input.localizationRate || input.localization_rate),
    published_at: safeIso(input.publishedAt || input.published_at) || new Date().toISOString(),
  };
}

export async function persistBriefAudit(input, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = getBriefHistoryConfig(env);
  const audit = buildBriefAudit(input);
  await supabaseRequest(config, "/world_pulse_history_briefs?on_conflict=slug", {
    method: "POST",
    body: audit,
    fetchImpl,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  return audit;
}
