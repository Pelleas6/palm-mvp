export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req) {
  return NextResponse.json({ ok: true, message: "POST /api/analyze OK" });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "GET /api/analyze OK" });
}
