export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../../../lib/env";
import { BUCKET } from "../../../lib/report";

const MAX_BYTES    = 20 * 1024 * 1024; // 20 Mo
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeName(name) {
  return (name || "file")
    .toString()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

function extFromType(type) {
  if (type === "image/png")  return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function ymd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rnd(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req) {
  const sessionId = req.cookies.get("palm_session")?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const origin = req.headers.get("origin") || req.headers.get("referer");
  const allowedOrigin = getEnv("SITE_URL") || "https://ma-ligne-de-vie.fr";
  if (origin && !origin.startsWith(allowedOrigin.replace(/\/$/, "")) && !origin.startsWith("http://localhost:")) {
     return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const sessionData = await redis.get(`session:${sessionId}`);
  if (!sessionData) return NextResponse.json({ error: "Session expired" }, { status: 401 });
  const session = JSON.parse(sessionData);

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { left, right } = body || {};

  for (const [side, file] of [["left", left], ["right", right]]) {
    if (!file || typeof file !== "object") {
      return NextResponse.json({ error: `Missing ${side} meta` }, { status: 400 });
    }
    const { name, type, size } = file;
    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: `${side}: type non autorisé (${type || "?"})` }, { status: 400 });
    }
    if (typeof size !== "number" || size <= 0) {
      return NextResponse.json({ error: `${side}: size invalide` }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: `${side}: fichier trop lourd (max 20 Mo)` }, { status: 413 });
    }
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: `${side}: name invalide` }, { status: 400 });
    }
  }

  const dateFolder = ymd();
  const stamp      = Date.now();
  const crypto     = require("crypto");
  const requestId  = crypto.randomBytes(16).toString("hex");
  const leftPath   = `uploads/${dateFolder}/${stamp}_${rnd()}_left_${safeName(left.name)}.${extFromType(left.type)}`;
  const rightPath  = `uploads/${dateFolder}/${stamp}_${rnd()}_right_${safeName(right.name)}.${extFromType(right.type)}`;
  
  await redis.set(`request:${requestId}`, JSON.stringify({ email: session.email, leftPath, rightPath, status: "signed" }), { ex: 86400 });

  const { data: leftSigned,  error: leftErr  } = await supabase.storage.from(BUCKET).createSignedUploadUrl(leftPath);
  if (leftErr || !leftSigned?.signedUrl) {
    return NextResponse.json({ error: `Supabase signed upload error (left): ${leftErr?.message || "unknown"}` }, { status: 500 });
  }

  const { data: rightSigned, error: rightErr } = await supabase.storage.from(BUCKET).createSignedUploadUrl(rightPath);
  if (rightErr || !rightSigned?.signedUrl) {
    return NextResponse.json({ error: `Supabase signed upload error (right): ${rightErr?.message || "unknown"}` }, { status: 500 });
  }

  return NextResponse.json({
    requestId,
    leftPath,
    rightPath,
    leftSignedUrl:  leftSigned.signedUrl,
    rightSignedUrl: rightSigned.signedUrl,
  });
}
