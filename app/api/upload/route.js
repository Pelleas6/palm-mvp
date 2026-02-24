export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("API UPLOAD APPELÉ");

    // 🔎 On récupère les variables proprement
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("ENV CHECK:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlStartsWithHttps:
        typeof supabaseUrl === "string" &&
        supabaseUrl.startsWith("https://"),
    });

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE env vars in server");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const left = formData.get("left");
    const right = formData.get("right");

    if (!(left instanceof File) || !(right instanceof File)) {
      return NextResponse.json(
        { error: "Files missing" },
        { status: 400 }
      );
    }

    const bucket = "palm-uploads";
    const timestamp = Date.now();

    const leftPath = `left-${timestamp}-${left.name}`;
    const rightPath = `right-${timestamp}-${right.name}`;

    const leftBuffer = Buffer.from(await left.arrayBuffer());
    const rightBuffer = Buffer.from(await right.arrayBuffer());

    const { error: leftError } = await supabase.storage
      .from(bucket)
      .upload(leftPath, leftBuffer, {
        contentType: left.type,
        upsert: true,
      });

    if (leftError) {
      console.error("LEFT UPLOAD ERROR:", leftError);
      return NextResponse.json(
        { error: leftError.message },
        { status: 500 }
      );
    }

    const { error: rightError } = await supabase.storage
      .from(bucket)
      .upload(rightPath, rightBuffer, {
        contentType: right.type,
        upsert: true,
      });

    if (rightError) {
      console.error("RIGHT UPLOAD ERROR:", rightError);
      return NextResponse.json(
        { error: rightError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      leftPath,
      rightPath,
    });
  } catch (err: any) {
    console.error("UPLOAD EXCEPTION:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
