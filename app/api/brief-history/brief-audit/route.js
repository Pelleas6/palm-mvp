export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { persistBriefAudit, requestHasHistoryAccess } from "../../../../lib/brief-history.js";
import { guardRequest, rateLimitHeaders } from "../../../../lib/request-guard.js";

export async function POST(request) {
  const rateLimit = guardRequest(request, { scope: "brief-history-audit", limit: 12, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Trop de demandes rapprochées." }, { status: 429, headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } });
  }
  if (!requestHasHistoryAccess(request)) {
    return NextResponse.json({ error: "Autorisation requise." }, { status: 401, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  }
  try {
    const body = await request.json();
    const audit = await persistBriefAudit(body);
    return NextResponse.json({ state: "audited", audit }, { status: 201, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ state: "not_audited", error: error?.message || "Audit indisponible." }, { status: error?.status || 503, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } });
  }
}
