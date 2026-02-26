export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : "";
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

function makeSupabaseClient() {
  const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function uploadWithRetry(supabase, path, buffer, contentType, retries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: false });

    if (!error) return null;
    lastError = error;

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return lastError;
}

export async function POST(req) {
  const TIMEOUT_MS = 20_000;

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), TIMEOUT_MS)
  );

  try {
    const response = await Promise.race([handleUpload(req), timeoutPromise]);
    return response;
  } catch (e) {
    return NextResponse.json(
      { error: `Upload API error: ${e?.message || "unknown"}` },
      { status: 500 }
    );
  }
}

async function handleUpload(req) {
  const supabase = makeSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL or Supabase key — check Vercel env vars." },
      { status: 500 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 415 });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Impossible de parser le formulaire" }, { status: 400 });
  }

  const left = formData.get("leftHand");
  const right = formData.get("rightHand");

  // En runtime nodejs, File existe, mais on garde un message clair si non.
  if (!left || !right) {
    return NextResponse.json({ error: "Files missing" }, { status: 400 });
  }
  if (typeof left.arrayBuffer !== "function" || typeof right.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Files missing (not file objects)" }, { status: 400 });
  }

  if (left.size === 0 || right.size === 0) {
    return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(left.type) || !ALLOWED_TYPES.has(right.type)) {
    return NextResponse.json({ error: "Type non supporté (JPG/PNG/WEBP)" }, { status: 400 });
  }

  if (left.size > MAX_BYTES || right.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (max 5 MB)" }, { status: 400 });
  }

  const ts = Date.now();
  const leftPath = `left/${ts}-${safeName(left.name)}.${extFromType(left.type)}`;
  const rightPath = `right/${ts}-${safeName(right.name)}.${extFromType(right.type)}`;

  const [leftBuf, rightBuf] = await Promise.all([
    left.arrayBuffer().then((ab) => Buffer.from(ab)),
    right.arrayBuffer().then((ab) => Buffer.from(ab)),
  ]);

  const leftErr = await uploadWithRetry(supabase, leftPath, leftBuf, left.type);
  if (leftErr) {
    return NextResponse.json({ error: `Left upload failed: ${leftErr.message}` }, { status: 500 });
  }

  const rightErr = await uploadWithRetry(supabase, rightPath, rightBuf, right.type);
  if (rightErr) {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([leftPath]);
    if (removeErr) {
      console.error("[upload] Rollback failed for", leftPath, removeErr.message);
    }
    return NextResponse.json({ error: `Right upload failed: ${rightErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Upload Supabase OK",
    bucket: BUCKET,
    leftPath,
    rightPath,
  });
}
