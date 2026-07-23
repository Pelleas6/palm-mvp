import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { feature } from "topojson-client";
import overviewTopology from "../data/world-pulse-admin-overview-3pct.topo.json" with { type: "json" };

test("map overview keeps only readable first-level administrative boundaries", () => {
  const objectName = Object.keys(overviewTopology.objects)[0];
  const boundaries = feature(overviewTopology, overviewTopology.objects[objectName]);
  const countries = new Set(boundaries.features.map((item) => item.properties.iso_a2));

  assert.equal(boundaries.features.length, 740);
  assert.deepEqual([...countries].sort(), [
    "AR", "AU", "BR", "CA", "CL", "CN", "CO", "DE", "DZ", "EG", "ES", "FR", "ID", "IN",
    "IR", "JP", "KR", "MA", "MX", "NG", "NZ", "PE", "PK", "PL", "SA", "UA", "US", "ZA",
  ]);
  assert.ok(!countries.has("IT"), "Italian provinces must not turn the map into a grid");
  assert.ok(!countries.has("GB"), "UK local authorities must not turn the map into a grid");
  assert.ok(!countries.has("TH"), "Thai provinces must not turn the map into a grid");
});

test("map does not draw Antarctica as a dashed unavailable-country line", async () => {
  const source = await readFile(new URL("../components/WorldMap.js", import.meta.url), "utf8");

  assert.match(source, /filter\(\(code\) => code && code !== "AQ"\)/);
  assert.match(source, /world-pulse-map-boundaries\.js/);
  assert.doesNotMatch(source, /WORLD_ADMIN1_BOUNDARY_COLLECTION,[\s\S]*world-pulse-geography/);
});
