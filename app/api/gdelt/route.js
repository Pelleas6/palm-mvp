export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorldPulseDashboardPayload, responseHeadersForPayload } from "../../../lib/world-pulse.js";
import { guardRequest, rateLimitHeaders } from "../../../lib/request-guard.js";

export async function GET(request) {
  const rateLimit = guardRequest(request, { scope: "world-pulse-api", limit: 90, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { state: "rate_limited", error: { reason: "Trop de demandes rapprochées. Réessayez dans un instant." } },
      {
        status: 429,
        headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  try {
    const payload = await getWorldPulseDashboardPayload();
    return NextResponse.json(payload, {
      status: 200,
      headers: { ...responseHeadersForPayload(payload), ...rateLimitHeaders(rateLimit) },
    });
  } catch {
    return NextResponse.json(
      { state: "error", error: { reason: "Le service de lecture est momentanément indisponible." } },
      { status: 503, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
