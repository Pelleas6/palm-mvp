export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildVersionPayload } from "../../../lib/version-proof.js";

export async function GET() {
  return NextResponse.json(buildVersionPayload(), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
