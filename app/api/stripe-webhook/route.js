export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import Stripe from "stripe";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getResendClient } from "../../../lib/resend";

const BUCKET = "palm-uploads";
const ADMIN_EMAIL = "karim.soualem@gmail.com";
const FROM_EMAIL = "contact@ma-ligne-de-vie.fr";

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function mimeFromPath(path) {
  const p = (path || "").toLowerCase();
  if (p.endsWith(".png"))  return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function calculerAge(dateNaissance) {
  const naissance = new Date(dateNaissance);
  const aujourd = new Date();
  let age = aujourd.getFullYear() - naissance.getFullYear();
  const m = aujourd.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && aujourd.getDate() < naissance.getDate())) age--;
  return age;
}

function trancheAge(age) {
  if (age < 25) return "jeune adulte (moins de 25 ans), en pleine construction identitaire, les lignes sont encore en évolution";
  if (age < 35) return "adulte jeune (25-35 ans), phase d'affirmation et de choix structurants";
  if (age < 50) return "adulte accompli (35-50 ans), les lignes reflètent des expériences de vie marquantes";
  if (age < 65) return "adulte mature (50-65 ans), grande richesse de vécu lisible dans les mains";
  return "senior (plus de 65 ans), mains chargées d'histoire et de sagesse accumulée";
}

function labelTheme(themeId) {
  const map = {
    amour:         "Amour & Relations — concentre toute l'analyse sur la vie sentimentale, les liens affectifs, la capacité à aimer et à recevoir de l'amour",
    travail:       "Travail & Carrière — concentre toute l'analyse sur les ambitions professionnelles, les talents, la réussite et le leadership",
    developpement: "Développement personnel — concentre toute l'analyse sur l'évolution intérieure, le potentiel caché, la croissance spirituelle et personnelle",
    finances:      "Finances & Abondance — concentre toute l'analyse sur le rapport à l'argent, la capacité à créer de l'abondance et la gestion des ressources",
    famille:       "Famille & Liens — concentre toute l'analyse sur les liens familiaux, l'ancrage, les relations proches et la transmission",
  };
  return map[themeId] || "Analyse générale";
}

async function downloadFromSupabase(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Supabase download error: ${error.message}`);
  const buffer = await data.arrayBuffer();
  return Buffer.from(buffer);
}

function reportToHtml(report) {
  return report.split("\n").map((l) => {
    if (l.startsWith("## ")) return `<h2 class="rh2">${l.slice(3)}</h2>`;
    if (l.startsWith("---"))  return `<hr class="rhr">`;
    if (l.startsWith("*") && l.endsWith("*")) return `<p class="rit">${l.replace(/\*/g,"")}</p>`;
    if (!l.trim()) return "";
    return `<p class="rp">${l}</p>`;
  }).join("");
}

function clientEmailHtml(prenom, report) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#fff;font-family:Georgia,serif;-webkit-text-size-adjust:100%;color:#3A3228}
  .w{max-width:580px;margin:0 auto;padding:32px 24px;box-sizing:border-box}
  .rh2{font-size:15px;font-weight:700;color:#3A3228;margin:28px 0 6px;padding-bottom:6px;border-bottom:1px solid #C9A84C;letter-spacing:.03em}
  .rhr{border:none;border-top:1px solid #E8E0D0;margin:24px 0}
  .rit{font-style:italic;color:#7A6F65;font-size:12px;margin:16px 0 0}
  .rp{margin:0 0 14px;font-size:15px;color:#3A3228;line-height:1.85;word-break:break-word}
  @media(max-width:480px){.w{padding:20px 16px}.rp{font-size:15px}}
</style>
</head>
<body>
<div class="w">
  <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #E8E0D0">
    <div style="font-size:26px;margin-bottom:10px">🌿</div>
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;margin-bottom:6px">Ligne de Vie</div>
    <div style="font-size:11px;color:#7A6F65">ma-ligne-de-vie.fr</div>
  </div>
  <p style="margin:0 0 6px;font-size:17px">Bonjour <strong>${prenom}</strong>,</p>
  <p style="margin:0 0 32px;font-size:14px;color:#7A6F65;line-height:1.7">Veuillez trouver ci-dessous votre analyse personnalisée.</p>
  ${reportToHtml(report)}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E0D0">
    <p style="margin:0;font-size:12px;color:#7A6F65;line-height:1.7">Vos photos ont été supprimées de nos serveurs après traitement.<br>Ce rapport est strictement personnel et confidentiel.</p>
  </div>
  <p style="margin:28px 0 0;font-size:11px;color:#7A6F65;text-align:center;letter-spacing:.04em">© 2026 Ligne de Vie · Confidentiel · Personnalisé · Sérieux</p>
</div>
</body>
</html>`.trim();
}

function adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #ddd;">
    <h2 style="margin:0 0 20px;color:#3A3228;font-size:18px;">🔔 Nouvelle analyse — ${prenom} ${nom}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
      <tr><td style="padding:10px 8px;color:#7A6F65;width:150px;border-bottom:1px solid #eee;">Prénom / Nom</td><td style="padding:10px 8px;font-weight:bold;color:#3A3228;border-bottom:1px solid #eee;">${prenom} ${nom}</td></tr>
      <tr><td style="padding:10px 8px;color:#7A6F65;border-bottom:1px solid #eee;">Email client</td><td style="padding:10px 8px;color:#3A3228;border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#7A9E7E;">${email}</a></td></tr>
      <tr><td style="padding:10px 8px;color:#7A6F65;border-bottom:1px solid #eee;">Date de naissance</td><td style="padding:10px 8px;color:#3A3228;border-bottom:1px solid #eee;">${dateNaissance}</td></tr>
      <tr><td style="padding:10px 8px;color:#7A6F65;">Thème choisi</td><td style="padding:10px 8px;color:#3A3228;">${themeChoisi}</td></tr>
    </table>
    <h3 style="font-size:15px;color:#3A3228;margin:0 0 14px;border-bottom:1px solid #eee;padding-bottom:8px;">Rapport</h3>
    <div style="font-size:13px;color:#3A3228;line-height:1.7;white-space:pre-wrap;">${report}</div>
  </div>
</body>
</html>`.trim();
}

async function generateReport(supabase, client, prenom, dateNaissance, themeChoisi, leftPath, rightPath) {
  const age = calculerAge(dateNaissance);
  const tranche = trancheAge(age);
  const theme = labelTheme(themeChoisi);

  const prompt = `Tu es un expert en analyse morphologique des mains avec 20 ans d'expérience en dermato-morphologie et psychologie des formes.

Tu analyses les deux mains de ${prenom}, ${tranche}.
Thème prioritaire : ${theme}.

STRUCTURE OBLIGATOIRE du rapport (en français, ~600 mots) :

## Synthèse
Paragraphe d'introduction synthétisant les traits dominants observés sur les deux mains.

## Main gauche — potentiel naturel
Analyse détaillée des lignes et formes de la main gauche. Ce que révèle le potentiel inné.

## Main droite — parcours vécu
Analyse détaillée des lignes et formes de la main droite. Ce que révèle le vécu et les choix.

## Éclairage thématique — ${themeChoisi}
Focus approfondi sur le thème choisi. Insights concrets et personnalisés.

## Recommandations
2-3 pistes concrètes et bienveillantes pour avancer sur ce thème.

---

## Mot de votre expert
Terminez le rapport par ce message chaleureux, personnel et bienveillant, en une ou deux phrases naturelles adaptées au thème et à ce que vous avez observé chez ${prenom}. Puis concluez toujours par :

*J'espère que cette lecture vous aura apporté un éclairage utile. Prenez soin de vous.*

*Votre expert — Ligne de Vie 🌿*

RÈGLES :
- Utilise uniquement ce qui est visible sur les photos
- Ton bienveillant, professionnel, précis
- Jamais de généralités vagues
- Pas de mention d'IA ou d'automatisation`;

  const [leftBuf, rightBuf] = await Promise.all([
    downloadFromSupabase(supabase, leftPath),
    downloadFromSupabase(supabase, rightPath),
  ]);

  const leftB64  = leftBuf.toString("base64");
  const rightB64 = rightBuf.toString("base64");
  const leftMime  = mimeFromPath(leftPath);
  const rightMime = mimeFromPath(rightPath);

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    max_output_tokens: 4000,
    input: [{
      role: "user",
      content: [
        { type: "input_text",  text: prompt },
        { type: "input_text",  text: "Photo main gauche :" },
        { type: "input_image", image_url: `data:${leftMime};base64,${leftB64}` },
        { type: "input_text",  text: "Photo main droite :" },
        { type: "input_image", image_url: `data:${rightMime};base64,${rightB64}` },
      ],
    }],
  });

  return resp.output_text || "Aucun texte généré.";
}

export async function POST(req) {
  const stripeSecret  = getEnv("STRIPE_SECRET_KEY");
  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    console.error("Webhook signature error:", e.message);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const session = event.data.object;
  const { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath } = session.metadata || {};

  if (!prenom || !nom || !email || !dateNaissance || !themeChoisi || !leftPath || !rightPath) {
    console.error("Metadata manquante dans la session Stripe");
    return NextResponse.json({ error: "Metadata manquante." }, { status: 400 });
  }

  try {
    const supabaseUrl  = getEnv("SUPABASE_URL");
    const supabaseKey  = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey    = getEnv("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const client   = new OpenAI({ apiKey: openaiKey });
    const resend   = getResendClient();

    const report = await generateReport(supabase, client, prenom, dateNaissance, themeChoisi, leftPath, rightPath);

    await Promise.all([
      resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Votre analyse de ligne de vie",
        html: clientEmailHtml(prenom, report),
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `Nouvelle analyse — ${prenom} ${nom}`,
        html: adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report),
      }),
    ]);

    await Promise.allSettled([
      supabase.storage.from(BUCKET).remove([leftPath]),
      supabase.storage.from(BUCKET).remove([rightPath]),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("Webhook analyze error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
