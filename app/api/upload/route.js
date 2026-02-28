export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";
const MAX_BYTES = 20 * 1024 * 1024; // 20 Mo
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
    .slice(0, 80);
}

function extFromType(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function ymd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rnd(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req) {
  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const left = body?.left;
  const right = body?.right;

  // left/right attendus :
  // { name: "xxx.jpg", type: "image/jpeg", size: 12345 }
  for (const [side, file] of [
    ["left", left],
    ["right", right],
  ]) {
    if (!file || typeof file !== "object") {
      return NextResponse.json({ error: `Missing ${side} meta` }, { status: 400 });
    }
    const { name, type, size } = file;
    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { error: `${side}: type non autorisé (${type || "?"})` },
        { status: 400 }
      );
    }
    if (typeof size !== "number" || size <= 0) {
      return NextResponse.json({ error: `${side}: size invalide` }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${side}: fichier trop lourd (max 20 Mo)` },
        { status: 413 }
      );
    }
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: `${side}: name invalide` }, { status: 400 });
    }
  }

  const dateFolder = ymd();
  const stamp = Date.now();
  const leftBase = safeName(left.name);
  const rightBase = safeName(right.name);

  const leftPath = `uploads/${dateFolder}/${stamp}_${rnd()}_left_${leftBase}.${extFromType(left.type)}`;
  const rightPath = `uploads/${dateFolder}/${stamp}_${rnd()}_right_${rightBase}.${extFromType(right.type)}`;

  // urls signées d’upload (méthode la plus propre : Vercel ne reçoit pas les fichiers)
  const { data: leftSigned, error: leftErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(leftPath);

  if (leftErr || !leftSigned?.signedUrl) {
    return NextResponse.json(
      { error: `Supabase signed upload error (left): ${leftErr?.message || "unknown"}` },
      { status: 500 }
    );
  }

  const { data: rightSigned, error: rightErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(rightPath);

  if (rightErr || !rightSigned?.signedUrl) {
    return NextResponse.json(
      { error: `Supabase signed upload error (right): ${rightErr?.message || "unknown"}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    leftPath,
    rightPath,
    leftSignedUrl: leftSigned.signedUrl,
    rightSignedUrl: rightSigned.signedUrl,
  });
}
