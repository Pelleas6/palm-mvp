import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("SEO routes publish a crawl policy and every public reference page", async () => {
  const [robots, sitemap] = await Promise.all([
    source("app/robots.js"),
    source("app/sitemap.js"),
  ]);

  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /disallow: \["\/api\/"\]/);
  for (const path of ["/", "/carte-actualite-mondiale", "/methode-localisation-actualite", "/sources-rss-internationales", "/brief-mondial"]) {
    assert.ok(sitemap.includes(`"${path}"`), `sitemap should include ${path}`);
  }
});

test("root metadata declares the canonical URL and truthful structured data", async () => {
  const layout = await source("app/layout.js");

  assert.match(layout, /metadataBase: new URL\(SITE_ORIGIN\)/);
  assert.match(layout, /alternates: \{ canonical: "\/" \}/);
  assert.match(layout, /"@type": "WebSite"/);
  assert.match(layout, /"@type": "Organization"/);
  assert.match(layout, /Carte de l’actualité mondiale/);
});

test("evergreen SEO pages state the map method and RSS-source limits", async () => {
  const [mapPage, methodPage, sourcePage] = await Promise.all([
    source("app/carte-actualite-mondiale/page.jsx"),
    source("app/methode-localisation-actualite/page.jsx"),
    source("app/sources-rss-internationales/page.jsx"),
  ]);

  assert.match(mapPage, /Ce que la carte ne mesure pas/);
  assert.match(methodPage, /La règle de localisation/);
  assert.match(sourcePage, /Comment une source est évaluée/);
});
