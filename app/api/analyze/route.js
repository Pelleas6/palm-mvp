export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function downloadFromSupabase(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Supabase download error: ${error.message}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
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
        { error: "Expected JSON body: { leftPath, rightPath }" },
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

    const supabase = createClient(supabaseUrl, supabaseKey);

    const leftImg = await downloadFromSupabase(supabase, leftPath);
    const rightImg = await downloadFromSupabase(supabase, rightPath);

    // Ici tu brancheras OpenAI ensuite.
    // Pour l’instant on renvoie un rapport simple pour valider la chaîne.
    const report =
      `Analyse OK.\n\n` +
      `Main gauche: ${leftPath}\n` +
      `Main droite: ${rightPath}\n` +
      `Taille gauche: ${leftImg.length} bytes\n` +
      `Taille droite: ${rightImg.length} bytes\n`;

    return NextResponse.json({ report }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "Analyze failed", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
