export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    console.log("API UPLOAD APPELÉ");

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();

    // ✅ NOMS CORRECTS (doivent matcher ton front)
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!left || !right) {
      return NextResponse.json({ error: "Files missing" }, { status: 400 });
    }

    const bucket = "palm-uploads";
    const timestamp = Date.now();

    const leftPath = `left-${timestamp}-${left.name}`.replace(/\s+/g, "_");
    const rightPath = `right-${timestamp}-${right.name}`.replace(/\s+/g, "_");

    const leftBuffer = Buffer.from(await left.arrayBuffer());
    const rightBuffer = Buffer.from(await right.arrayBuffer());

    const { error: leftError } = await supabase.storage
      .from(bucket)
      .upload(leftPath, leftBuffer, {
        contentType: left.type || "image/jpeg",
        upsert: true,
      });

    if (leftError) {
      console.error("LEFT UPLOAD ERROR:", leftError);
      return NextResponse.json(
        { error: `Supabase upload error (left): ${leftError.message}` },
        { status: 500 }
      );
    }

    const { error: rightError } = await supabase.storage
      .from(bucket)
      .upload(rightPath, rightBuffer, {
        contentType: right.type || "image/jpeg",
        upsert: true,
      });

    if (rightError) {
      console.error("RIGHT UPLOAD ERROR:", rightError);
      return NextResponse.json(
        { error: `Supabase upload error (right): ${rightError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OK",
      leftPath,
      rightPath,
    });
  } catch (err) {
    console.error("UPLOAD EXCEPTION:", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
