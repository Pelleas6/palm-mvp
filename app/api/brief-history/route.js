export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { parseHistoryWindow, readBriefHistorySummary, requestHasHistoryAccess } from "../../../lib/brief-history.js";
import { guardRequest, rateLimitHeaders } from "../../../lib/request-guard.js";

export async function GET(request) {
  const rateLimit = guardRequest(request, { scope: "brief-history-read", limit: 20, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Trop de demandes rapprochées." }, { status: 429, headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } });
  }
  if (!requestHasHistoryAccess(request)) {
    return NextResponse.json({ error: "Autorisation requise." }, { status: 401, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  }
  try {
    const window = parseHistoryWindow(request.nextUrl);
    const summary = await readBriefHistorySummary(window);
    return NextResponse.json(summary, { headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Historique indisponible." }, { status: error?.status || 503, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  }
}
