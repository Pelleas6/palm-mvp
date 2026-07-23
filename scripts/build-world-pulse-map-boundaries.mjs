import { readFile, writeFile } from "node:fs/promises";
import { SOURCE_COUNTRY_REGISTRY } from "../lib/world-pulse-geography.js";

const inputUrl = new URL("../data/world-pulse-admin-1-3pct.topo.json", import.meta.url);
const outputUrl = new URL("../data/world-pulse-admin-overview-3pct.topo.json", import.meta.url);
const countriesOutputUrl = new URL("../data/world-pulse-map-countries.json", import.meta.url);

// The overview is deliberately a first-level administrative reading of the map.
// Detailed municipal/district boundaries stay in the server-side reference data so
// article placement can remain precise without turning the visual map into a grid.
const OVERVIEW_COUNTRY_CODES = new Set([
  "US", "CA", "MX",
  "BR", "AR", "CL", "CO", "PE",
  "FR", "DE", "ES", "PL", "UA",
  "DZ", "MA", "EG", "NG", "ZA",
  "PK", "IN", "CN", "JP", "KR", "ID", "IR", "SA",
  "AU", "NZ",
]);

function visitArcReferences(value, callback) {
  if (typeof value === "number") {
    callback(value >= 0 ? value : -value - 1);
    return;
  }
  value.forEach((entry) => visitArcReferences(entry, callback));
}

function remapArcReferences(value, arcIndexByOriginal) {
  if (typeof value === "number") {
    const original = value >= 0 ? value : -value - 1;
    const mapped = arcIndexByOriginal.get(original);
    if (mapped === undefined) throw new Error(`Missing arc ${original} in overview map.`);
    return value >= 0 ? mapped : -mapped - 1;
  }
  return value.map((entry) => remapArcReferences(entry, arcIndexByOriginal));
}

const topology = JSON.parse(await readFile(inputUrl, "utf8"));
const sourceObjectName = Object.keys(topology.objects || {})[0];
const sourceGeometries = topology.objects?.[sourceObjectName]?.geometries || [];
const overviewGeometries = sourceGeometries.filter((geometry) => (
  OVERVIEW_COUNTRY_CODES.has(String(geometry?.properties?.iso_a2 || "").toUpperCase())
));
const arcReferences = new Set();

overviewGeometries.forEach((geometry) => visitArcReferences(geometry.arcs, (arc) => arcReferences.add(arc)));
const selectedArcs = [...arcReferences].sort((left, right) => left - right);
const arcIndexByOriginal = new Map(selectedArcs.map((arc, index) => [arc, index]));

const overviewTopology = {
  type: "Topology",
  transform: topology.transform,
  arcs: selectedArcs.map((arc) => topology.arcs[arc]),
  objects: {
    "admin-1-overview": {
      type: "GeometryCollection",
      geometries: overviewGeometries.map((geometry) => ({
        type: geometry.type,
        arcs: remapArcReferences(geometry.arcs, arcIndexByOriginal),
        properties: { iso_a2: geometry.properties.iso_a2 },
      })),
    },
  },
};

const mapCountries = SOURCE_COUNTRY_REGISTRY.map(({ code, isoNumeric, label }) => ({ code, isoNumeric, label }));

await Promise.all([
  writeFile(outputUrl, `${JSON.stringify(overviewTopology)}\n`),
  writeFile(countriesOutputUrl, `${JSON.stringify(mapCountries, null, 2)}\n`),
]);

console.log(`World map overview: ${overviewGeometries.length} boundaries across ${OVERVIEW_COUNTRY_CODES.size} countries.`);
