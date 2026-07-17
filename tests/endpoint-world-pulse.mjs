import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

function listen(server, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(server.address().port));
  });
}

async function getFreePort() {
  const server = createServer((_, res) => res.end("ok"));
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url, timeoutMs = 20_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error(`Timeout waiting for ${url}`);
}

let mode = "rss";
let counts = { rss: 0, ngrams: 0, gdeltDoc: 0 };

const mockServer = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/rss") {
    counts.rss += 1;
    if (mode === "rss") {
      res.writeHead(200, { "content-type": "application/rss+xml" });
      res.end(`<?xml version="1.0"?><rss><channel>
        <item><title>Climate fallback signal in France</title><link>https://rss.example/climate?utm_campaign=test</link><pubDate>Wed, 15 Jul 2026 12:01:00 GMT</pubDate><description>Real RSS item with explicit event country.</description></item>
        <item><title>Climate fallback signal in France</title><link>https://mirror.example/climate-copy</link><pubDate>Wed, 15 Jul 2026 12:00:00 GMT</pubDate></item>
      </channel></rss>`);
      return;
    }
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("rss down");
    return;
  }

  if (url.pathname.startsWith("/ngrams/")) {
    counts.ngrams += 1;
    if (mode === "rss") {
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      res.end([
        JSON.stringify({ ID: 1, date: "2026-07-15T11:45:00.000Z", lang: "en", title: "Technology signal", url: "https://toc.example/tech" }),
        JSON.stringify({ ID: 2, date: "2026-07-15T11:45:00.000Z", lang: "fr", title: "Election signal", url: "https://toc.example/election" }),
      ].join("\n"));
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("not-json-lines");
    return;
  }

  if (url.pathname === "/gdelt") {
    counts.gdeltDoc += 1;
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Your query has been rate limited by GDELT");
    return;
  }

  res.writeHead(404).end("not found");
});

const mockPort = await listen(mockServer);

async function runNextScenario(value) {
  mode = value;
  counts = { rss: 0, ngrams: 0, gdeltDoc: 0 };
  const nextPort = await getFreePort();
  const next = spawn("./node_modules/.bin/next", ["start", "-H", "127.0.0.1", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WORLD_PULSE_GDELT_ENDPOINT: `http://127.0.0.1:${mockPort}/gdelt`,
      WORLD_PULSE_RSS_FEEDS: `Mock RSS|http://127.0.0.1:${mockPort}/rss|France|French|Europe`,
      WORLD_PULSE_NGRAMS_BASE_URL: `http://127.0.0.1:${mockPort}/ngrams`,
      WORLD_PULSE_GDELT_CANARY_DELAY_MS: "600000",
      WORLD_PULSE_RSS_TIMEOUT_MS: "500",
      WORLD_PULSE_NGRAMS_TIMEOUT_MS: "500",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let nextLog = "";
  next.stdout.on("data", (chunk) => { nextLog += chunk.toString(); });
  next.stderr.on("data", (chunk) => { nextLog += chunk.toString(); });

  try {
    await waitFor(`http://127.0.0.1:${nextPort}/`);
    const response = await fetch(`http://127.0.0.1:${nextPort}/api/gdelt`, { cache: "no-store" });
    const payload = await response.json();
    assert.equal(response.status, 200);

    const beforeHealthCounts = { ...counts };
    const healthResponse = await fetch(`http://127.0.0.1:${nextPort}/api/gdelt/health`, { cache: "no-store" });
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(counts, beforeHealthCounts, "health endpoint must not call external sources");

    const beforePageCounts = { ...counts };
    const pageResponse = await fetch(`http://127.0.0.1:${nextPort}/sante-sources`, { cache: "no-store" });
    const pageHtml = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(pageHtml, /Lecture mémoire uniquement/);
    assert.deepEqual(counts, beforePageCounts, "health page must not call external sources");

    return { payload, health, counts: { ...counts } };
  } finally {
    next.kill("SIGTERM");
    await new Promise((resolve) => next.once("exit", resolve));
    if (process.env.DEBUG_ENDPOINT_TEST === "1") {
      console.error(nextLog);
    }
  }
}

try {
  const rss = await runNextScenario("rss");
  assert.equal(rss.payload.state, "ok");
  assert.equal(rss.payload.source.active, "RSS_PUBLIC");
  assert.equal(rss.payload.cache.ttlSeconds, 900);
  assert.equal(rss.payload.counts.articles, 1);
  assert.equal(rss.payload.counts.localized, 1);
  assert.equal(rss.payload.counts.unlocalized, 0);
  assert.equal(rss.payload.articles[0].label, "Climat/environnement");
  assert.equal(rss.payload.counts.rssArticles, 1);
  assert.equal(rss.payload.counts.gdeltNgramsDocuments, 2);
  assert.equal(rss.payload.counts.rssClassificationCoveragePct, 100);
  assert.equal(rss.payload.articles[0].sourceCountry, "France");
  assert.equal(rss.payload.articles[0].sourceLocation?.code, "FR");
  assert.equal(rss.payload.globalTrends.documents, 2);
  assert.ok(rss.health.items.some((entry) => entry.source === "Mock RSS" && entry.state === "OK"));
  assert.equal(rss.counts.rss, 1);
  assert.equal(rss.counts.ngrams, 1);
  assert.equal(rss.counts.gdeltDoc, 0);
  console.log(`RSS primary: state=${rss.payload.state} articles=${rss.payload.counts.articles} localized=${rss.payload.counts.localized} source=${rss.payload.source.active} ttl=${rss.payload.cache.ttlSeconds}s trends=${rss.payload.globalTrends.documents}`);

  const unavailable = await runNextScenario("unavailable");
  assert.equal(unavailable.payload.state, "unavailable");
  assert.equal(unavailable.payload.source.active, "none");
  assert.equal(unavailable.payload.counts.articles, 0);
  assert.ok(unavailable.payload.sourceHealth.some((entry) => entry.source === "Mock RSS" && entry.state === "HTTP_ERROR"));
  assert.ok(unavailable.payload.sourceHealth.some((entry) => entry.source === "GDELT Web N-Grams TOC" && entry.state === "INVALID_RESPONSE"));
  console.log(`Unavailable: state=${unavailable.payload.state} articles=${unavailable.payload.counts.articles} sourceHealth=${unavailable.payload.sourceHealth.length}`);

  console.log("Endpoint scenarios PASS");
} finally {
  await new Promise((resolve) => mockServer.close(resolve));
}
