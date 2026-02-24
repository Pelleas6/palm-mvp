export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFilename(name) {
  // garde seulement lettres/chiffres/.-_ et limite la longueur
  const base = (name || "file")
    .split("/")
    .pop()
    .split("\\")
    .pop()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);

  // évite le vide
  return base.length ? base : "file";
}

function extFromMime(mime) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function jsonError(message, status = 400, extra = undefined) {
  return NextResponse.json({ ok: false, error: message, ...(extra || {}) }, { status });
}

export async function POST(req) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let leftPath = null;

  try {
    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!(left instanceof File) || !(right instanceof File)) {
      return jsonError("Files missing (expected leftHand and rightHand)", 400);
    }

    // Taille max
    if (left.size > MAX_BYTES || right.size > MAX_BYTES) {
      return jsonError("File too large (max 5MB each)", 413, {
        leftBytes: left.size,
        rightBytes: right.size,
        maxBytes: MAX_BYTES,
      });
    }

    // Type MIME
    if (!ALLOWED_MIME.has(left.type) || !ALLOWED_MIME.has(right.type)) {
      return jsonError("Unsupported file type (allowed: JPEG, PNG, WebP)", 415, {
        leftType: left.type,
        rightType: right.type,
      });
    }

    const ts = Date.now();
    const leftName = sanitizeFilename(left.name);
    const rightName = sanitizeFilename(right.name);

    // Chemins clairs + extensions cohérentes
    leftPath = `left/${ts}-${leftName}.${extFromMime(left.type)}`;
    const rightPath = `right/${ts}-${rightName}.${extFromMime(right.type)}`;

    const leftBuf = Buffer.from(await left.arrayBuffer());
    const rightBuf = Buffer.from(await right.arrayBuffer());

    // Upload gauche
    const upLeft = await supabase.storage.from(BUCKET).upload(leftPath, leftBuf, {
      contentType: left.type,
      upsert: false,
      cacheControl: "3600",
    });

    if (upLeft.error) {
      return jsonError(`Supabase left upload: ${upLeft.error.message}`, 500);
    }

    // Upload droite
    const upRight = await supabase.storage.from(BUCKET).upload(rightPath, rightBuf, {
      contentType: right.type,
      upsert: false,
      cacheControl: "3600",
    });

    if (upRight.error) {
      // Rollback: supprimer la gauche si la droite échoue
      try {
        await supabase.storage.from(BUCKET).remove([leftPath]);
      } catch (e) {
        // on log côté serveur mais on renvoie l’erreur initiale
        console.error("ROLLBACK REMOVE FAILED:", e);
      }
      return jsonError(`Supabase right upload: ${upRight.error.message}`, 500);
    }

    return NextResponse.json({
      ok: true,
      message: "Upload Supabase OK",
      bucket: BUCKET,
      leftPath,
      rightPath,
    });
  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    // Rollback best-effort si on avait déjà upload la gauche
    if (leftPath) {
      try {
        await supabase.storage.from(BUCKET).remove([leftPath]);
      } catch {}
    }
    return jsonError("Upload failed", 500);
  }
}
