export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWorldPulse, responseHeadersForPayload } from "../../../lib/world-pulse.js";

export async function GET() {
  const payload = await getWorldPulse();
  return NextResponse.json(payload, {
    status: 200,
    headers: responseHeadersForPayload(payload),
  });
}
