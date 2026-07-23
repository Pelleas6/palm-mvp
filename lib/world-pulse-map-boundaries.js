import { feature } from "topojson-client";
import overviewTopology from "../data/world-pulse-admin-overview-3pct.topo.json" with { type: "json" };

const overviewObjectName = Object.keys(overviewTopology.objects || {})[0];

// This small visual layer is separate from the complete geography used on the
// server to locate an article inside its state, region or province.
export const WORLD_ADMIN1_BOUNDARY_COLLECTION = Object.freeze(feature(
  overviewTopology,
  overviewTopology.objects[overviewObjectName],
));
