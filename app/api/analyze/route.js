export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function mimeFromPath(path) {
  const p = (path || "").toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function downloadFromSupabase(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Supabase download error: ${error.message}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

async function deleteFromSupabase(supabase, paths) {
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn(`Supabase delete warning: ${error.message}`);
  }
}

export async function POST(req) {
  let supabase = null;
  let leftPath = null;
  let rightPath = null;

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Expected JSON body: { leftPath, rightPath }" },
        { status: 415 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON. Expected body: { leftPath, rightPath }" },
        { status: 400 }
      );
    }

    leftPath = body?.leftPath;
    rightPath = body?.rightPath;

    if (!isNonEmptyString(leftPath) || !isNonEmptyString(rightPath)) {
      return NextResponse.json(
        { error: "Il faut 2 chemins: leftPath et rightPath.", received: body },
        { status: 400 }
      );
    }

    const supabaseUrl =
      getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseKey =
      getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
      getEnv("SUPABASE_ANON_KEY") ||
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const openaiKey = getEnv("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_*_KEY in env" },
        { status: 500 }
      );
    }
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in env" },
        { status: 500 }
      );
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    const leftBuf = await downloadFromSupabase(supabase, leftPath);
    const rightBuf = await downloadFromSupabase(supabase, rightPath);

    const leftMime = mimeFromPath(leftPath);
    const rightMime = mimeFromPath(rightPath);

    const leftB64 = leftBuf.toString("base64");
    const rightB64 = rightBuf.toString("base64");

    const client = new OpenAI({ apiKey: openaiKey });

    const prompt =
      "Tu es un expert en chiromancie. Analyse la main gauche et la main droite à partir des 2 photos. " +
      "Rends un rapport structuré en français, clair, utile, sans parler de santé/maladie. " +
      "Sections : Synthèse, Main gauche, Main droite, Comparaison, Points forts, Points à travailler, Conclusion. " +
      "Sois concret, évite les généralités.";

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      max_output_tokens: 1200,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_text", text: "Photo main gauche :" },
            { type: "input_image", image_url: `data:${leftMime};base64,${leftB64}` },
            { type: "input_text", text: "Photo main droite :" },
            { type: "input_image", image_url: `data:${rightMime};base64,${rightB64}` },
          ],
        },
      ],
    });

    const report = resp.output_text || "Aucun texte généré.";

    // Suppression des images après analyse — RGPD
    await deleteFromSupabase(supabase, [leftPath, rightPath]);

    return NextResponse.json({ report }, { status: 200 });
  } catch (e) {
    // Suppression quand même en cas d'erreur
    if (supabase && leftPath && rightPath) {
      await deleteFromSupabase(supabase, [leftPath, rightPath]);
    }
    return NextResponse.json(
      { error: "Analyze failed", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
