export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function safeName(name) {
  return (name || "file")
    .toString()
    .replace(/\.[^.]+$/, "")
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
      getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseKey =
      getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
      getEnv("SUPABASE_ANON_KEY") ||
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_*_KEY in env" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const form = await req.formData();
    const left = form.get("left");
    const right = form.get("right");

    if (!left || !right) {
      return NextResponse.json(
        { error: "Expected form-data fields: left and right" },
        { status: 400 }
      );
    }

    if (typeof left === "string" || typeof right === "string") {
      return NextResponse.json(
        { error: "Invalid files: left/right must be File objects" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(left.type) || !ALLOWED_TYPES.has(right.type)) {
      return NextResponse.json(
        { error: "Only jpeg/png/webp are allowed" },
        { status: 415 }
      );
    }

    if (left.size > MAX_BYTES || right.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Max size is ${MAX_BYTES} bytes` },
        { status: 413 }
      );
    }

    const rnd = Math.random().toString(16).slice(2);
    const stamp = Date.now();

    const leftPath = `uploads/${stamp}_${rnd}_left_${safeName(left.name)}.${extFromType(left.type)}`;
    const rightPath = `uploads/${stamp}_${rnd}_right_${safeName(right.name)}.${extFromType(right.type)}`;

    const leftBuf = Buffer.from(await left.arrayBuffer());
    const rightBuf = Buffer.from(await right.arrayBuffer());

    const up1 = await supabase.storage.from(BUCKET).upload(leftPath, leftBuf, {
      contentType: left.type,
      upsert: false,
    });

    if (up1.error) {
      return NextResponse.json(
        { error: `Supabase upload error (left): ${up1.error.message}` },
        { status: 500 }
      );
    }

    const up2 = await supabase.storage.from(BUCKET).upload(rightPath, rightBuf, {
      contentType: right.type,
      upsert: false,
    });

    if (up2.error) {
      return NextResponse.json(
        { error: `Supabase upload error (right): ${up2.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ leftPath, rightPath }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
