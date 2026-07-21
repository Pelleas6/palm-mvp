"use client";

import { useEffect, useState } from "react";
import WorldMap from "./WorldMap";
import { WORLD_PULSE_SIGNAL_LEGEND } from "../lib/world-pulse-signals.js";

const PATCH_FLAG = Symbol.for("le-pouls-du-monde.maplibre-category-clusters.v2");
const PALETTE = WORLD_PULSE_SIGNAL_LEGEND.map((category) => ({
  ...category,
  key: `category_${category.id}`,
}));

const CLUSTER_PROPERTIES = Object.fromEntries(
  PALETTE.map((category) => [
    category.key,
    ["+", ["case", ["==", ["get", "c"], category.label], 1, 0]],
  ]),
);

const CATEGORY_COUNTS = PALETTE.map((category) => [
  "coalesce",
  ["get", category.key],
  0,
]);
const MAX_CATEGORY_COUNT = ["max", ...CATEGORY_COUNTS];
const CLUSTER_COLOR = [
  "case",
  ...PALETTE.flatMap((category) => [
    ["==", ["coalesce", ["get", category.key], 0], MAX_CATEGORY_COUNT],
    category.color,
  ]),
  "#aab9b5",
];

function unwrapRing(ring) {
  if (!Array.isArray(ring) || ring.length < 2) return ring;

  let offset = 0;
  let previousLongitude = Number(ring[0]?.[0]);

  return ring.map((coordinate, index) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return coordinate;

    const longitude = Number(coordinate[0]);
    const latitude = Number(coordinate[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return coordinate;

    if (index === 0) {
      previousLongitude = longitude;
      return [...coordinate];
    }

    let adjustedLongitude = longitude + offset;
    const delta = adjustedLongitude - previousLongitude;

    if (delta > 180) {
      offset -= 360;
      adjustedLongitude -= 360;
    } else if (delta < -180) {
      offset += 360;
      adjustedLongitude += 360;
    }

    previousLongitude = adjustedLongitude;
    return [adjustedLongitude, latitude, ...coordinate.slice(2)];
  });
}

function normalizeGeometry(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return geometry;

  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(unwrapRing),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map(unwrapRing)),
    };
  }

  return geometry;
}

function normalizeCountryCollection(data) {
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) return data;

  return {
    ...data,
    features: data.features.map((feature) => ({
      ...feature,
      geometry: normalizeGeometry(feature?.geometry),
    })),
  };
}

function patchMapLibre(maplibregl) {
  const prototype = maplibregl?.Map?.prototype;
  if (!prototype || prototype[PATCH_FLAG]) return;

  const originalAddSource = prototype.addSource;
  const originalAddLayer = prototype.addLayer;

  Object.defineProperty(prototype, PATCH_FLAG, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  prototype.addSource = function addSourceWithMapFixes(id, source) {
    if (id === "countries" && source?.type === "geojson") {
      return originalAddSource.call(this, id, {
        ...source,
        data: normalizeCountryCollection(source.data),
      });
    }

    if (id === "signals" && source?.type === "geojson" && source?.cluster) {
      return originalAddSource.call(this, id, {
        ...source,
        clusterProperties: {
          ...(source.clusterProperties || {}),
          ...CLUSTER_PROPERTIES,
        },
      });
    }

    return originalAddSource.call(this, id, source);
  };

  prototype.addLayer = function addLayerWithCategoryColors(layer, beforeId) {
    if (
      layer?.source === "signals"
      && layer?.type === "circle"
      && ["clusters", "cluster-halo"].includes(layer.id)
    ) {
      const patchedLayer = {
        ...layer,
        paint: {
          ...(layer.paint || {}),
          "circle-color": CLUSTER_COLOR,
          ...(layer.id === "cluster-halo" ? { "circle-opacity": 0.28 } : {}),
        },
      };
      return originalAddLayer.call(this, patchedLayer, beforeId);
    }
    return originalAddLayer.call(this, layer, beforeId);
  };
}

export default function WorldMapGuard() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    import("maplibre-gl")
      .then((module) => {
        patchMapLibre(module.default);
      })
      .catch((error) => {
        console.error("MapLibre preparation failed:", error);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {ready ? (
        <WorldMap />
      ) : (
        <section className="map-guard-loading" aria-live="polite">
          <strong>Préparation de la carte</strong>
          <span>Chargement du rendu cartographique…</span>
        </section>
      )}

      <style jsx>{`
        .map-guard-loading {
          width: min(1320px, calc(100% - 32px));
          min-height: 74vh;
          margin: 0 auto;
          display: grid;
          place-content: center;
          gap: 8px;
          color: #effafa;
          text-align: center;
        }
        .map-guard-loading span { color: #9ebbbb; font-size: .78rem; }
      `}</style>

      <style jsx global>{`
        #carte > .world-map {
          position: relative !important;
          z-index: 0 !important;
          inset: auto !important;
          width: 100% !important;
          height: auto !important;
          opacity: 1 !important;
          filter: none !important;
          isolation: isolate;
        }
        #carte > .world-map .world-map__wrap {
          width: min(1320px, calc(100% - 32px));
        }
        #carte > .world-map .world-map__header {
          min-height: 188px;
          align-items: center;
          gap: 34px;
          padding: 26px 8px 28px;
        }
        #carte > .world-map .world-map__header h1 {
          max-width: 980px;
          font-size: clamp(2.15rem, 3.8vw, 4.25rem);
          line-height: .99;
          letter-spacing: -.05em;
        }
        #carte > .world-map .map-shell {
          z-index: 0;
          isolation: isolate;
          background: #06141b;
        }
        @media (max-width: 980px) {
          #carte > .world-map .world-map__header {
            grid-template-columns: 1fr;
            min-height: 0;
            gap: 16px;
          }
        }
        @media (max-width: 760px) {
          #carte > .world-map .world-map__wrap {
            width: min(1320px, calc(100% - 20px));
          }
          #carte > .world-map .world-map__header { padding: 18px 6px 20px; }
          #carte > .world-map .world-map__header h1 {
            font-size: clamp(1.9rem, 9.5vw, 2.7rem);
            line-height: 1.02;
          }
          #carte > .world-map .map-shell {
            border-right: 1px solid rgba(137, 194, 195, .24);
            border-left: 1px solid rgba(137, 194, 195, .24);
            border-radius: 16px;
          }
        }
      `}</style>
    </>
  );
}
