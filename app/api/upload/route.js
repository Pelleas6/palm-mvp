export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const { leftUrl, rightUrl } = await req.json();

    if (!leftUrl || !rightUrl) {
      return NextResponse.json(
        { error: "Missing leftUrl or rightUrl" },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });

    const r = await client.responses.create({
      model: "gpt-5.1",
      input: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Tu es un expert en chiromancie. Analyse ces deux photos (main gauche puis main droite). " +
                "Réponds en français, structuré avec titres courts : " +
                "1) Observations (forme de la main, doigts, lignes), " +
                "2) Interprétation (personnalité, tendances), " +
                "3) Conseils concrets, " +
                "4) Résumé en 5 points. " +
                "Sois bienveillant et interdiction complete pour les affirmations médicales.",
            },
            { type: "input_image", image_url: leftUrl },
            { type: "input_image", image_url: rightUrl },
          ],
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      analysis: r.output_text || "",
    });
  } catch (e) {
    console.error("ANALYZE ERROR:", e);
    return NextResponse.json(
      { error: "AI analysis failed" },
      { status: 500 }
    );
  }
}
