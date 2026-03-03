export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { processAnalyzePayload, processInvalidPhotosPayload } from "../../../lib/process-analysis";

export async function POST(req) {
  try {
    const body = await req.json();

    if (body.type === "invalid_photos") {
      const { status, payload } = await processInvalidPhotosPayload(body);
      return NextResponse.json(payload, { status });
    }

    const { status, payload } = await processAnalyzePayload(body);
    return NextResponse.json(payload, { status });

  } catch (e) {
    console.error("process-job error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
