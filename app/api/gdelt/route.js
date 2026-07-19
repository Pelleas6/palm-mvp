export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorldPulseDashboardPayload, responseHeadersForPayload } from "../../../lib/world-pulse.js";
import { guardRequest, rateLimitHeaders } from "../../../lib/request-guard.js";

function versionHeadersForPayload(payload) {
  const version = typeof payload?.generatedAt === "string" ? payload.generatedAt : "";
  return {
    ...responseHeadersForPayload(payload),
    ...(version
      ? {
          "X-World-Pulse-Version": version,
          ETag: `W/"${version}"`,
        }
      : {}),
  };
}

function requestIsFresh(request, etag) {
  if (!etag) return false;
  return String(request.headers.get("if-none-match") || "")
    .split(",")
    .map((value) => value.trim())
    .includes(etag);
}

function checkRateLimit(request) {
  return guardRequest(request, { scope: "world-pulse-api", limit: 90, windowMs: 60_000 });
}

export async function GET(request) {
  const rateLimit = checkRateLimit(request);
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
      headers: { ...versionHeadersForPayload(payload), ...rateLimitHeaders(rateLimit) },
    });
  } catch {
    return NextResponse.json(
      { state: "error", error: { reason: "Le service de lecture est momentanément indisponible." } },
      { status: 503, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

// Le navigateur sonde seulement cet en-tête toutes les 30 secondes. Il ne
// retélécharge le snapshot complet que si le cache serveur a produit une
// nouvelle version : la carte ne se reconstruit donc plus inutilement.
export async function HEAD(request) {
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { ...rateLimitHeaders(rateLimit), "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store, max-age=0" },
    });
  }

  try {
    const payload = await getWorldPulseDashboardPayload();
    const headers = { ...versionHeadersForPayload(payload), ...rateLimitHeaders(rateLimit) };
    return new NextResponse(null, {
      status: requestIsFresh(request, headers.ETag) ? 304 : 204,
      headers,
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store, max-age=0" },
    });
  }
}
