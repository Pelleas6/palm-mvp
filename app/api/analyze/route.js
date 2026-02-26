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

function serializeError(e) {
  // OpenAI SDK errors often include: status, error, message, headers
  return {
    name: e?.name,
    message: e?.message,
    status: e?.status,
    code: e?.code,
    type: e?.type,
    // Sometimes SDK puts the API payload here:
    error: e?.error,
    // Sometimes it’s nested:
    response: e?.response,
    stack: (e?.stack || "").split("\n").slice(0, 6).join("\n"),
  };
}

export async function POST(req) {
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

    const leftPath = body?.leftPath;
    const rightPath = body?.rightPath;

    if (!isNonEmptyString(leftPath) || !isNonEmptyString(rightPath)) {
      return NextResponse.json(
        { error: "Expected JSON body: { leftPath, rightPath }", received: body },
        { status: 400 }
      );
    }

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

    const openaiKey = getEnv("OPENAI_API_KEY");
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in env (Vercel env + redeploy)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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
      "Sections : Synthèse, Main gauche, Main droite, Comparaison, Points forts, Points à travailler, Conclusion.";

    // Limite la taille de sortie pour éviter les réponses énormes/longues
    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      max_output_tokens: 1200,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_text", text: "Photo main gauche :" },
            {
              type: "input_image",
              image_url: `data:${leftMime};base64,${leftB64}`,
            },
            { type: "input_text", text: "Photo main droite :" },
            {
              type: "input_image",
              image_url: `data:${rightMime};base64,${rightB64}`,
            },
          ],
        },
      ],
    });

    const report = resp.output_text || "Aucun texte généré.";

    return NextResponse.json(
      { report, meta: { leftPath, rightPath } },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Analyze failed", details: serializeError(e) },
      { status: 500 }
    );
  }
}
