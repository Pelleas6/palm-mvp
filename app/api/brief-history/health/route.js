export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { briefHistoryReadiness } from "../../../../lib/brief-history.js";

export async function GET() {
  const readiness = briefHistoryReadiness();
  return NextResponse.json(readiness, {
    status: readiness.state === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
