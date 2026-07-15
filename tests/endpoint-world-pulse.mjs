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

let mode = "gdelt";
const mockServer = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/gdelt") {
    if (mode === "gdelt") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        articles: [
          {
            url: "https://gdelt.example/economy?utm_source=test",
            title: "Global economy signal",
            domain: "gdelt.example",
            sourcecountry: "France",
            language: "French",
            seendate: "20260715120000",
          },
          {
            url: "https://gdelt.example/economy",
            title: "Duplicate economy signal",
            domain: "gdelt.example",
            sourcecountry: "France",
            language: "French",
            seendate: "20260715115900",
          },
        ],
      }));
      return;
    }
    if (mode === "rss") {
      await sleep(650);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ articles: [] }));
      return;
    }
    res.writeHead(502, { "content-type": "text/plain" });
    res.end("gdelt down");
    return;
  }

  if (url.pathname === "/rss") {
    if (mode === "rss") {
      res.writeHead(200, { "content-type": "application/rss+xml" });
      res.end(`<?xml version="1.0"?><rss><channel>
        <item><title>Climate fallback signal</title><link>https://rss.example/climate</link><pubDate>Wed, 15 Jul 2026 12:01:00 GMT</pubDate><description>Real RSS item.</description></item>
        <item><title>Duplicate fallback signal</title><link>https://rss.example/climate?utm_campaign=dup</link><pubDate>Wed, 15 Jul 2026 12:00:00 GMT</pubDate></item>
      </channel></rss>`);
      return;
    }
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("rss down");
    return;
  }

  res.writeHead(404).end("not found");
});

const mockPort = await listen(mockServer);

async function runNextScenario(value) {
  mode = value;
  const nextPort = await getFreePort();
  const next = spawn("./node_modules/.bin/next", ["start", "-H", "127.0.0.1", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WORLD_PULSE_GDELT_ENDPOINT: `http://127.0.0.1:${mockPort}/gdelt`,
      WORLD_PULSE_RSS_FEEDS: `Mock RSS|http://127.0.0.1:${mockPort}/rss|France`,
      WORLD_PULSE_GDELT_TIMEOUT_MS: "200",
      WORLD_PULSE_RSS_TIMEOUT_MS: "200",
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
    return payload;
  } finally {
    next.kill("SIGTERM");
    await new Promise((resolve) => next.once("exit", resolve));
    if (process.env.DEBUG_ENDPOINT_TEST === "1") {
      console.error(nextLog);
    }
  }
}

try {
  const gdelt = await runNextScenario("gdelt");
  assert.equal(gdelt.state, "ok");
  assert.equal(gdelt.source.active, "GDELT");
  assert.equal(gdelt.cache.ttlSeconds, 300);
  assert.equal(gdelt.counts.articles, 1);
  assert.equal(gdelt.counts.localized, 1);
  assert.equal(gdelt.counts.unlocalized, 0);
  assert.equal(gdelt.articles[0].label, "Économie");
  assert.equal(gdelt.articles[0].sourceLocation?.code, "FR");
  console.log(`GDELT success: state=${gdelt.state} articles=${gdelt.counts.articles} localized=${gdelt.counts.localized} source=${gdelt.source.active} ttl=${gdelt.cache.ttlSeconds}s`);

  const rss = await runNextScenario("rss");
  assert.equal(rss.state, "partial");
  assert.equal(rss.source.active, "RSS_FALLBACK");
  assert.equal(rss.cache.ttlSeconds, 300);
  assert.equal(rss.counts.articles, 1);
  assert.equal(rss.counts.localized, 1);
  assert.equal(rss.counts.unlocalized, 0);
  assert.equal(rss.articles[0].label, "Climat");
  assert.equal(rss.articles[0].sourceCountry, "France");
  assert.equal(rss.articles[0].sourceLocation?.code, "FR");
  console.log(`RSS fallback: state=${rss.state} articles=${rss.counts.articles} localized=${rss.counts.localized} source=${rss.source.active} ttl=${rss.cache.ttlSeconds}s`);

  const unavailable = await runNextScenario("unavailable");
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.source.active, "none");
  assert.equal(unavailable.counts.articles, 0);
  assert.ok(unavailable.error.causes.some((cause) => cause.source === "GDELT"));
  assert.ok(unavailable.error.causes.some((cause) => cause.source === "RSS_FALLBACK"));
  console.log(`Unavailable: state=${unavailable.state} articles=${unavailable.counts.articles} causes=${unavailable.error.causes.length}`);

  console.log("Endpoint scenarios PASS");
} finally {
  await new Promise((resolve) => mockServer.close(resolve));
}
