import { NextResponse } from "next/server";
import { getVisitCount } from "../../../lib/visit-counter.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const increment = request.nextUrl.searchParams.get("increment") === "1";
  const result = await getVisitCount({ increment });

  return NextResponse.json(
    { count: result.count, counted: result.ok && increment },
    {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
