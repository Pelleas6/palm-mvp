export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "palm-uploads";

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const { leftPath, rightPath } = await req.json();
    if (!leftPath || !rightPath) {
      return NextResponse.json({ error: "Missing leftPath or rightPath" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // URLs signées (5 minutes)
    const { data: leftSigned, error: leftSErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(leftPath, 300);

    const { data: rightSigned, error: rightSErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(rightPath, 300);

    if (leftSErr || rightSErr) {
      return NextResponse.json(
        {
          error: "Signed URL failed",
          left: leftSErr?.message,
          right: rightSErr?.message,
        },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const r = await client.responses.create({
      model: "gpt-4.1", // vision input OK :contentReference[oaicite:2]{index=2}
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Tu es un expert en chiromancie. Analyse ces deux photos (main gauche puis main droite). " +
                "Réponds en français avec titres courts : 1) Observations 2) Interprétation 3) Conseils 4) Résumé (5 points). " +
                "Sois bienveillant et évite les affirmations médicales.",
            },
            { type: "input_image", image_url: leftSigned.signedUrl },
            { type: "input_image", image_url: rightSigned.signedUrl },
          ],
        },
      ],
    });

    return NextResponse.json({ ok: true, analysis: r.output_text || "" });
  } catch (e) {
    // IMPORTANT : on renvoie le message (sans secrets) pour debug
    console.error("ANALYZE ERROR:", e);
    return NextResponse.json(
      { error: "AI analysis failed", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
