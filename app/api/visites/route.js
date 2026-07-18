import { NextResponse } from "next/server";
import { getVisitCount } from "../../../lib/visit-counter.js";
import { guardRequest, rateLimitHeaders } from "../../../lib/request-guard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const increment = request.nextUrl.searchParams.get("increment") === "1";
  const rateLimit = guardRequest(request, {
    scope: increment ? "visit-counter-increment" : "visit-counter-read",
    limit: increment ? 8 : 45,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { count: null, counted: false, error: "Trop de demandes rapprochées." },
      {
        status: 429,
        headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  let result;
  try {
    result = await getVisitCount({ increment });
  } catch {
    result = { ok: false, count: null };
  }

  return NextResponse.json(
    { count: result.count, counted: result.ok && increment },
    {
      status: result.ok ? 200 : 503,
      headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store, max-age=0" },
    },
  );
}
