export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    console.log("API UPLOAD APPELÉ");

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE env vars" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!(left instanceof File) || !(right instanceof File)) {
      return NextResponse.json(
        { error: "Files missing (not File objects)" },
        { status: 400 }
      );
    }

    const bucket = "palm-uploads";
    const timestamp = Date.now();

    const leftPath = `left-${timestamp}-${left.name}`.replace(/\s+/g, "_");
    const rightPath = `right-${timestamp}-${right.name}`.replace(/\s+/g, "_");

    const leftBuffer = Buffer.from(await left.arrayBuffer());
    const rightBuffer = Buffer.from(await right.arrayBuffer());

    const upLeft = await supabase.storage
      .from(bucket)
      .upload(leftPath, leftBuffer, {
        contentType: left.type || "image/jpeg",
        upsert: true,
      });

    if (upLeft.error) {
      console.error("LEFT UPLOAD ERROR:", upLeft.error);
      return NextResponse.json(
        { error: `Supabase upload error (left): ${upLeft.error.message}` },
        { status: 500 }
      );
    }

    const upRight = await supabase.storage
      .from(bucket)
      .upload(rightPath, rightBuffer, {
        contentType: right.type || "image/jpeg",
        upsert: true,
      });

    if (upRight.error) {
      console.error("RIGHT UPLOAD ERROR:", upRight.error);
      return NextResponse.json(
        { error: `Supabase upload error (right): ${upRight.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Upload OK",
      leftPath,
      rightPath,
    });
  } catch (err) {
    console.error("UPLOAD EXCEPTION:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
