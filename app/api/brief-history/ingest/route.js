export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { persistBriefHistorySnapshot, requestHasHistoryAccess } from "../../../../lib/brief-history.js";
import { getWorldPulse } from "../../../../lib/world-pulse.js";
import { guardRequest, rateLimitHeaders } from "../../../../lib/request-guard.js";

export async function POST(request) {
  const rateLimit = guardRequest(request, { scope: "brief-history-ingest", limit: 12, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Trop de déclenchements rapprochés." }, { status: 429, headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } });
  }
  if (!requestHasHistoryAccess(request)) {
    return NextResponse.json({ error: "Autorisation requise." }, { status: 401, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  }
  try {
    const payload = await getWorldPulse({ awaitGdeltCanary: true });
    const result = await persistBriefHistorySnapshot(payload);
    return NextResponse.json({ state: "stored", ...result }, { status: 201, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ state: "not_stored", error: error?.message || "Stockage indisponible." }, { status: error?.status || 503, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  }
}
