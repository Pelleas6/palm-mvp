// app/api/analyze/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const BUCKET = "palm-uploads";
const MAX_BYTES = 5 * 1024 * 1024; // sécurité côté serveur

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : "";
}

function assertPath(p) {
  if (!p || typeof p !== "string") return false;
  // ultra simple + safe: on attend "left/..." et "right/..."
  if (p.includes("..")) return false;
  if (!(p.startsWith("left/") || p.startsWith("right/"))) return false;
  return true;
}

async function blobToBase64DataUrl(blob) {
  const ab = await blob.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length > MAX_BYTES) {
    throw new Error("File too large after download (server-side)");
  }
  const contentType = blob.type || "image/jpeg";
  const b64 = buf.toString("base64");
  return `data:${contentType};base64,${b64}`;
}

export async function POST(req) {
  try {
    // 1) Env
    const supabaseUrl =
      getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseKey =
      getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
      getEnv("SUPABASE_ANON_KEY") ||
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY...)" },
        { status: 500 }
      );
    }

    const openaiKey = getEnv("OPENAI_API_KEY");
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // 2) Body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Expected JSON body: { leftPath, rightPath }" },
        { status: 400 }
      );
    }

    const leftPath = body?.leftPath;
    const rightPath = body?.rightPath;

    if (!assertPath(leftPath) || !assertPath(rightPath)) {
      return NextResponse.json(
        { error: "Invalid leftPath/rightPath" },
        { status: 400 }
      );
    }

    // 3) Download from Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [{ data: leftBlob, error: leftErr }, { data: rightBlob, error: rightErr }] =
      await Promise.all([
        supabase.storage.from(BUCKET).download(leftPath),
        supabase.storage.from(BUCKET).download(rightPath),
      ]);

    if (leftErr || !leftBlob) {
      return NextResponse.json(
        { error: `Supabase download failed (left): ${leftErr?.message || "unknown"}` },
        { status: 500 }
      );
    }
    if (rightErr || !rightBlob) {
      return NextResponse.json(
        { error: `Supabase download failed (right): ${rightErr?.message || "unknown"}` },
        { status: 500 }
      );
    }

    const [leftDataUrl, rightDataUrl] = await Promise.all([
      blobToBase64DataUrl(leftBlob),
      blobToBase64DataUrl(rightBlob),
    ]);

    // 4) OpenAI call
    const client = new OpenAI({ apiKey: openaiKey });

    const model = getEnv("AI_VISION_MODEL") || "gpt-4.1-mini";

    const prompt = `
Tu es un lecteur de mains. Tu reçois 2 photos:
- main gauche = main de naissance
- main droite = main de l’expression actuelle

Rends un rapport en français EXACTEMENT dans ce format :

Voilà ton analyse

Analyse intuitive de la main gauche (main de naissance)

1. Forme de la main :
2. Ligne de vie :
3. Ligne de tête :
4. Ligne du cœur :
5. Monts visibles :
🔮 Lecture vibratoire :
✋ Synthèse globale :

Analyse intuitive de la main droite  (main de l’expression actuelle)

1. Forme de la main :
2. Ligne de vie :
3. Ligne de tête :
4. Ligne du cœur :
5. Monts visibles :
🔮 Lecture vibratoire :
✋ Synthèse globale :

Synthèse des deux mains ✋️ ✋️ :
`.trim();

    const resp = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: leftDataUrl },
            { type: "input_image", image_url: rightDataUrl },
          ],
        },
      ],
    });

    // 5) Extract text
    const outText =
      resp.output_text ||
      "Analyse générée, mais aucun texte n’a été extrait (output_text vide).";

    return NextResponse.json({
      ok: true,
      model,
      leftPath,
      rightPath,
      analysis: outText,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `AI analysis failed: ${e?.message || "unknown"}` },
      { status: 500 }
    );
  }
}
