import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const retiredRoutes = [
  "/ligne-de-vie-courte",
  "/ligne-de-coeur",
  "/ligne-de-tete",
  "/signification-ligne-de-vie-cassee",
  "/lecture-main-gauche-droite",
  "/lecture-complete-des-lignes-de-la-main",
  "/comment-ca-marche",
  "/faq",
  "/tarifs",
  "/merci",
];

const removedFiles = [
  "app/api/analyze/route.js",
  "app/api/create-checkout/route.js",
  "app/api/process-job/route.js",
  "app/api/send-otp/route.js",
  "app/api/stripe-webhook/route.js",
  "app/api/upload/route.js",
  "app/api/verify-otp/route.js",
  "lib/openai-client.js",
  "lib/process-analysis.js",
  "lib/report.js",
  "lib/resend.js",
];

test("all confirmed palm-reading routes return a permanent retirement response", () => {
  const proxy = read("proxy.js");
  assert.match(proxy, /status:\s*410/);
  assert.match(proxy, /X-Robots-Tag/);

  for (const route of retiredRoutes) {
    assert.ok(proxy.includes(`\"${route}\"`), `${route} must remain explicitly retired`);
  }
});

test("old palm-reading application files stay deleted", () => {
  for (const path of removedFiles) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} must not return`);
  }
});

test("public metadata and sitemap only describe Le Pouls du Monde", () => {
  const publicSeo = [
    read("app/layout.js"),
    read("app/sitemap.js"),
    read("app/robots.js"),
    read("lib/site-metadata.js"),
    read("package.json"),
  ].join("\n");

  for (const legacyTerm of ["Palm-MVP", "Lecture de Mains", "chiromancie", "analyse de vos mains"]) {
    assert.equal(publicSeo.toLowerCase().includes(legacyTerm.toLowerCase()), false, `${legacyTerm} must not appear in public SEO files`);
  }

  assert.match(publicSeo, /Le Pouls du Monde/);
  assert.match(read("app/layout.js"), /z3do0K5J5Kk1zgY0nhmEliHiGZdeZLc7_ZTCFUJX-mA/);
});
