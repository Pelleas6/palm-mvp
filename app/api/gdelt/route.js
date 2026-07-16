export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorldPulseDashboardPayload, responseHeadersForPayload } from "../../../lib/world-pulse.js";

export async function GET() {
  const payload = await getWorldPulseDashboardPayload();
  return NextResponse.json(payload, {
    status: 200,
    headers: responseHeadersForPayload(payload),
  });
}
