import assert from "node:assert/strict";
import test from "node:test";
import { briefHistoryReadiness, buildBriefAudit, buildHistorySnapshot, parseHistoryWindow } from "../lib/brief-history.js";

const payload = {
  state: "ok",
  generatedAt: "2026-07-20T18:00:00.000Z",
  source: { active: "RSS_PUBLIC" },
  cache: { status: "miss" },
  articles: [
    { id: "a", title: "Signal localisé", url: "https://example.test/a?utm_source=x", mediaName: "Média A", eventCountry: "France", eventCountryIso: "FR", label: "Politique/élections", labelType: "registre déterministe", confidence: 88 },
    { id: "b", title: "Signal à qualifier", url: "https://example.test/b", mediaName: "Média B", label: "Non déterminé", labelType: "non déterminé", confidence: 0 },
    { id: "duplicate", title: "Doublon", url: "https://example.test/a", mediaName: "Média A", eventCountry: "France", eventCountryIso: "FR", label: "Politique/élections", labelType: "registre déterministe", confidence: 88 },
  ],
  sourceHealth: [{ source: "Média A", region: "Europe", url: "https://example.test/rss", state: "OK", articles: 2, recent: true, checkedAt: "2026-07-20T18:00:00.000Z" }],
};

test("history snapshot keeps a deduplicated, auditable RSS record", () => {
  const snapshot = buildHistorySnapshot(payload);
  assert.equal(snapshot.run.article_count, 2);
  assert.equal(snapshot.run.localized_count, 1);
  assert.equal(snapshot.run.localization_rate, 50);
  assert.equal(snapshot.articles[0].article_url, "https://example.test/a");
  assert.equal(snapshot.signals.length, 2);
});

test("history readiness never exposes secret values", () => {
  const readiness = briefHistoryReadiness({ SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "secret", WORLD_PULSE_INGEST_SECRET: "also-secret" });
  assert.equal(readiness.state, "ready");
  assert.equal(JSON.stringify(readiness).includes("secret"), false);
});

test("history window is bounded and brief audit needs deploy proof", () => {
  const window = parseHistoryWindow(new URL("https://site.test/api/brief-history?from=2026-07-13T00:00:00Z&to=2026-07-20T00:00:00Z&articles=999"));
  assert.equal(window.articleLimit, 250);
  const audit = buildBriefAudit({ slug: "semaine-du-13-au-19-juillet-2026", status: "published", gitSha: "145a9706a2da5ec054e5ef84e61d1470acc66c48", deploymentUrl: "https://ma-ligne-de-vie.fr/brief-mondial/semaine-du-13-au-19-juillet-2026" });
  assert.equal(audit.status, "published");
  assert.throws(() => buildBriefAudit({ slug: "bad slug", status: "published", gitSha: "bad", deploymentUrl: "x" }));
});
