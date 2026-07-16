export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorldPulseSourceHealthSnapshot } from "../../../../lib/world-pulse.js";

export async function GET() {
  const snapshot = getWorldPulseSourceHealthSnapshot();
  return NextResponse.json(snapshot, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
