export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorldPulseSourceHealthSnapshot } from "../../../../lib/world-pulse.js";
import { guardRequest, rateLimitHeaders } from "../../../../lib/request-guard.js";

export async function GET(request) {
  const rateLimit = guardRequest(request, { scope: "world-pulse-health", limit: 30, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes rapprochées." },
      { status: 429, headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store, max-age=0" } },
    );
  }
  const snapshot = getWorldPulseSourceHealthSnapshot();
  return NextResponse.json(snapshot, {
    status: 200,
    headers: {
      ...rateLimitHeaders(rateLimit),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
