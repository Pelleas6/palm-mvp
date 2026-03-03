import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
import { getResendClient } from "./resend";
import {
  ADMIN_EMAIL,
  FROM_EMAIL,
  cleanupImages,
  generateReport,
  invalidPhotoEmailHtml,
  sendEmails,
} from "./report";

export async function processAnalyzePayload(body) {
  const { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath } = body || {};
  if (!prenom || !nom || !email || !dateNaissance || !themeChoisi || !leftPath || !rightPath) {
    return { status: 400, payload: { error: "Données manquantes." } };
  }

  const resend = getResendClient();
  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const openai = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });

  const report = await generateReport(supabase, openai, prenom, dateNaissance, themeChoisi, leftPath, rightPath);
  await sendEmails(resend, prenom, nom, email, dateNaissance, themeChoisi, report);
  await cleanupImages(supabase, leftPath, rightPath);

  return { status: 200, payload: { ok: true } };
}

export async function processInvalidPhotosPayload(body) {
  const { prenom, nom, email } = body || {};
  if (!prenom || !nom || !email) {
    return { status: 400, payload: { error: "Données manquantes." } };
  }

  const resend = getResendClient();
  await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Votre dossier Ligne de Vie",
      html: invalidPhotoEmailHtml(prenom),
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `⚠️ Photos invalides — ${prenom} ${nom}`,
      html: `<p style="font-family:sans-serif">Photos invalides — <strong>${prenom} ${nom}</strong> (${email})</p>`,
    }),
  ]);

  return { status: 200, payload: { ok: true } };
}
