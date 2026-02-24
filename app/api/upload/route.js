export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // Test connexion Supabase
    try {
      const health = await fetch(`${supabaseUrl}/auth/v1/health`);
      if (!health.ok) {
        return NextResponse.json(
          { error: `Supabase health check failed (${health.status})` },
          { status: 500 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Cannot reach Supabase from Vercel (network error)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!(left instanceof File) || !(right instanceof File)) {
      return NextResponse.json(
        { error: "Files missing" },
        { status: 400 }
      );
    }

    const bucket = "palm-uploads";
    const ts = Date.now();

    const leftPath = `left/${ts}-${left.name}`.replace(/\s+/g, "_");
    const rightPath = `right/${ts}-${right.name}`.replace(/\s+/g, "_");

    const leftBuf = Buffer.from(await left.arrayBuffer());
    const rightBuf = Buffer.from(await right.arrayBuffer());

    const upLeft = await supabase.storage.from(bucket).upload(leftPath, leftBuf, {
      contentType: left.type || "image/jpeg",
      upsert: true,
    });

    if (upLeft.error) {
      return NextResponse.json(
        { error: `Supabase left upload: ${upLeft.error.message}` },
        { status: 500 }
      );
    }

    const upRight = await supabase.storage.from(bucket).upload(rightPath, rightBuf, {
      contentType: right.type || "image/jpeg",
      upsert: true,
    });

    if (upRight.error) {
      return NextResponse.json(
        { error: `Supabase right upload: ${upRight.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Upload Supabase OK",
      leftPath,
      rightPath,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed (unexpected error)" },
      { status: 500 }
    );
  }
}
