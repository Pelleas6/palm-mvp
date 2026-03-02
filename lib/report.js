export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";
import { getResendClient } from "../../../lib/resend";
import { generateReport, sendEmails, cleanupImages, invalidPhotoEmailHtml, ADMIN_EMAIL, FROM_EMAIL } from "../../../lib/report";

export async function POST(req) {
  try {
    const body     = await req.json();
    const resend   = getResendClient();
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const openai   = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });

    // Cas photos invalides
    if (body.type === "invalid_photos") {
      const { prenom, nom, email } = body;
      await Promise.all([
        resend.emails.send({ from: FROM_EMAIL, to: email,       subject: "Votre dossier Ligne de Vie",              html: invalidPhotoEmailHtml(prenom) }),
        resend.emails.send({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: `⚠️ Photos invalides — ${prenom} ${nom}`, html: `<p style="font-family:sans-serif">Photos invalides — <strong>${prenom} ${nom}</strong> (${email})</p>` }),
      ]);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Cas analyse normale
    const { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath } = body;
    if (!prenom || !email || !leftPath || !rightPath) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
    }

    const report = await generateReport(supabase, openai, prenom, dateNaissance, themeChoisi, leftPath, rightPath);
    await sendEmails(resend, prenom, nom, email, dateNaissance, themeChoisi, report);
    await cleanupImages(supabase, leftPath, rightPath);

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("process-job error:", e);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
