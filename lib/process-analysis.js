import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";
import { getResendClient } from "./resend.js";
import {
  ADMIN_EMAIL,
  FROM_EMAIL,
  cleanupImages,
  generateReport,
  invalidPhotoEmailHtml,
  sendEmails,
} from "./report.js";
import { getGeminiClient } from "./openai-client.js";

export async function processAnalyzePayload(body, options = {}) {
  const { geminiModel, supabase, resend } = options;

  const {
    prenom,
    nom,
    email,
    dateNaissance,
    themeChoisi,
    leftPath,
    rightPath,
  } = body || {};

  if (
    !prenom ||
    !nom ||
    !email ||
    !dateNaissance ||
    !themeChoisi ||
    !leftPath ||
    !rightPath
  ) {
    return {
      status: 400,
      payload: { error: "Données manquantes." },
    };
  }

  const finalResendClient = resend || getResendClient();

  const supabaseUrl = getEnv("SUPABASE_URL") || "mock-url";
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || "mock-key";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Configuration environnement manquante");
  }

  const supabaseClient = supabase || createClient(supabaseUrl, supabaseKey);
  const activeGeminiModel = geminiModel || getGeminiClient();

  try {
    const report = await generateReport(
      supabaseClient,
      activeGeminiModel,
      prenom,
      dateNaissance,
      themeChoisi,
      leftPath,
      rightPath
    );

    await sendEmails(
      finalResendClient,
      prenom,
      nom,
      email,
      dateNaissance,
      themeChoisi,
      report
    );
  } catch (e) {
    console.error("Erreur lors de la génération ou de l'envoi :", e);
    throw e;
  } finally {
    await cleanupImages(supabaseClient, leftPath, rightPath);
  }

  return {
    status: 200,
    payload: { ok: true },
  };
}

export async function processInvalidPhotosPayload(body) {
  const { prenom, nom, email } = body || {};

  if (!prenom || !nom || !email) {
    return {
      status: 400,
      payload: { error: "Données manquantes." },
    };
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

  return {
    status: 200,
    payload: { ok: true },
  };
}
