export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function safeName(name) {
  return (name || "file")
    .toString()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function extFromType(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req) {
  try {
    const supabaseUrl =
      getEnv("SUPABASE_URL") ||
      getEnv("NEXT_PUBLIC_SUPABASE_URL");

    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey =
      getEnv("SUPABASE_ANON_KEY") ||
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const supabaseKey = serviceRoleKey || anonKey;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!(left instanceof File) || !(right instanceof File)) {
      return NextResponse.json({ error: "Files missing" }, { status: 400 });
    }

    // type check
    if (!ALLOWED_TYPES.has(left.type) || !ALLOWED_TYPES.has(right.type)) {
      return NextResponse.json(
        { error: "Type non supporté. Formats autorisés: JPG, PNG, WEBP." },
        { status: 400 }
      );
    }

    // size check
    if (left.size > MAX_BYTES || right.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop lourd. Limite: 5MB par image." },
        { status: 400 }
      );
    }

    const ts = Date.now();
    const leftPath = `left/${ts}-${safeName(left.name)}.${extFromType(left.type)}`;
    const rightPath = `right/${ts}-${safeName(right.name)}.${extFromType(right.type)}`;

    // upload left
    const leftBuf = Buffer.from(await left.arrayBuffer());
    const upLeft = await supabase.storage
      .from(BUCKET)
      .upload(leftPath, leftBuf, { contentType: left.type, upsert: false });

    if (upLeft.error) {
      return NextResponse.json(
        { error: `Supabase left upload failed: ${upLeft.error.message}` },
        { status: 500 }
      );
    }

    // upload right
    const rightBuf = Buffer.from(await right.arrayBuffer());
    const upRight = await supabase.storage
      .from(BUCKET)
      .upload(rightPath, rightBuf, { contentType: right.type, upsert: false });

    if (upRight.error) {
      // rollback left
      await supabase.storage.from(BUCKET).remove([leftPath]);
      return NextResponse.json(
        { error: `Supabase right upload failed: ${upRight.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Upload Supabase OK",
      bucket: BUCKET,
      leftPath,
      rightPath
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Upload API error: ${e?.message || "unknown"}` },
      { status: 500 }
    );
  }
}
