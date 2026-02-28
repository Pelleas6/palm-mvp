export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getResendClient } from "../../../lib/resend";

const BUCKET = "palm-uploads";
const ADMIN_EMAIL = "karim.soualem@gmail.com";
const FROM_EMAIL = "contact@ma-ligne-de-vie.fr";

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
    amour: "Amour & Relations — concentre toute l'analyse sur la vie sentimentale, les liens affectifs, la capacité à aimer et à recevoir de l'amour",
    travail: "Travail & Carrière — concentre toute l'analyse sur les ambitions professionnelles, les talents, la réussite et le leadership",
    developpement: "Développement personnel — concentre toute l'analyse sur l'évolution intérieure, le potentiel caché, la croissance spirituelle et personnelle",
    finances: "Finances & Abondance — concentre toute l'analyse sur le rapport à l'argent, la capacité à créer de l'abondance et la gestion des ressources",
    famille: "Famille & Liens — concentre toute l'analyse sur les liens familiaux, l'ancrage, les relations proches et la transmission",
  };
  return map[themeId] || "Analyse générale";
}

async function downloadFromSupabase(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Supabase download error: ${error.message}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

async function deleteFromSupabase(supabase, paths) {
  const valid = paths.filter((p) => typeof p === "string" && p.trim().length > 0);
  if (!valid.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(valid);
  if (error) console.warn("Supabase delete warning:", error.message);
}

async function generateReport(client, prenom, nom, dateNaissance, themeChoisi, leftB64, rightB64, leftMime, rightMime) {
  const age = calculerAge(dateNaissance);
  const tranche = trancheAge(age);
  const civilite = `${prenom} ${nom}`;
  const focusTheme = labelTheme(themeChoisi);

  const prompt = `Tu es un chiromancien professionnel avec 20 ans d'expérience, formé aux traditions occidentale et orientale. Tu analyses les mains avec rigueur, précision et bienveillance.

Tu reçois deux photos : la main gauche et la main droite de ${civilite}.

CONTEXTE CONFIDENTIEL (n'utilise jamais ces données brutes dans le rapport) :
- La personne est ${tranche}.
- Calibre toute ton analyse en fonction de cette phase de vie.
- Ne mentionne jamais l'âge, la date de naissance ou ces informations brutes dans le rapport.

THÈME DE LECTURE CHOISI : ${focusTheme}
- Toutes les sections doivent être orientées autour de ce thème.
- Ne parle pas des autres domaines de vie sauf si c'est directement lié au thème choisi.
- Chaque observation visuelle doit être interprétée à travers le prisme de ce thème.

Rédige un rapport complet, structuré et personnalisé en français. Ton ton est sérieux, professionnel et légèrement chaleureux. Tu vouvoies toujours la personne et tu l'appelles "${civilite}" quand c'est naturel.

RÈGLES ABSOLUES :
- Ne parle jamais de santé, maladie, diagnostic médical ou espérance de vie.
- Interdiction d'inventer : si un détail n'est pas clairement visible sur la photo, écrivez-le explicitement (ex : "non visible avec certitude") et ne l'interprétez pas.
- Avant toute interprétation, commence chaque section par une courte description factuelle de ce que vous voyez.
- Chaque section doit faire minimum 5 phrases.
- Zéro généralité vague : chaque affirmation doit être reliée à un indice visuel.
- Le rapport doit faire au moins 600 mots.
- Si la photo est trop floue ou la paume pas assez ouverte, ajoutez une section "Qualité des photos" avec 3 recommandations.

STRUCTURE OBLIGATOIRE :

## Synthèse
Vue d'ensemble orientée vers le thème choisi. Au moins 3 indices visibles qui soutiennent cette synthèse.

## Main gauche — Le potentiel inné
Analyse détaillée orientée ${focusTheme}. Pour chaque élément : décrivez, interprétez, reliez à l'indice visuel.

## Main droite — Le vécu et les choix
Même niveau de détail. Mettez en évidence ce qui a évolué par rapport au potentiel inné dans le contexte du thème choisi.

## Comparaison — Ce que le temps a façonné
Comparez les deux mains dans le contexte du thème choisi. Chaque comparaison doit mentionner l'indice sur chaque main.

## Points forts
3 à 5 points forts concrets liés au thème choisi, chacun expliqué en 2-3 phrases.

## Points à travailler
3 à 5 axes de développement concrets liés au thème choisi. Toujours positif et constructif.

## Conclusion
Synthèse chaleureuse adressée à ${civilite}, orientée vers le thème choisi. Terminez sur une note d'ouverture et de confiance.

---
*Préparé avec soin par notre expert en chiromancie, 20 ans d'expérience dans le domaine.*`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "text", text: "Photo main gauche :" },
          { type: "image_url", image_url: { url: `data:${leftMime};base64,${leftB64}`, detail: "high" } },
          { type: "text", text: "Photo main droite :" },
          { type: "image_url", image_url: { url: `data:${rightMime};base64,${rightB64}`, detail: "high" } },
        ],
      },
    ],
  });

  return resp.choices?.[0]?.message?.content || "Aucun texte généré.";
}

function reportToHtml(report) {
  return report
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) return `<h2 style="color:#3A3228;font-size:17px;margin:28px 0 10px;border-bottom:1px solid #E8E0D0;padding-bottom:6px;">${line.replace("## ", "")}</h2>`;
      if (line.startsWith("---")) return `<hr style="border:none;border-top:1px solid #E8E0D0;margin:20px 0;">`;
      if (line.startsWith("*") && line.endsWith("*")) return `<p style="font-style:italic;color:#7A6F65;font-size:12px;margin:16px 0 0;">${line.replace(/\*/g, "")}</p>`;
      if (line.trim() === "") return "";
      return `<p style="margin:0 0 12px;font-size:14px;color:#3A3228;line-height:1.8;">${line}</p>`;
    })
    .join("");
}

function clientEmailHtml(prenom, report) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,serif;">
  <div style="max-width:620px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:36px;">🌿</div>
      <h1 style="margin:10px 0 4px;font-size:24px;color:#3A3228;font-weight:700;">Ligne de Vie</h1>
      <p style="margin:0;font-size:12px;color:#7A6F65;">ma-ligne-de-vie.fr</p>
    </div>

    <div style="background:#fff;border-radius:16px;border:1px solid #E8E0D0;padding:32px 28px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:18px;color:#3A3228;">Bonjour <strong>${prenom}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#7A6F65;line-height:1.7;">
        Voici votre rapport personnalisé de chiromancie. Il a été préparé avec soin à partir des photos de vos deux mains.
      </p>

      <div style="background:#FAF7F2;border-radius:12px;border:1px solid #E8E0D0;padding:24px;">
        ${reportToHtml(report)}
      </div>
    </div>

    <div style="background:#EFF5F0;border-radius:12px;border:1px solid #B5CDB7;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#5C7E60;line-height:1.6;">
        🔒 Vos photos ont été supprimées de nos serveurs après traitement.<br>
        Ce rapport est strictement personnel et confidentiel.
      </p>
    </div>

    <p style="text-align:center;font-size:11px;color:#7A6F65;line-height:1.6;margin:0;">
      © 2026 Ligne de Vie · ma-ligne-de-vie.fr<br>
      Confidentiel · Personnalisé · Sérieux
    </p>
  </div>
</body>
</html>`.trim();
}

function adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report) {
  return `
<!DOCTYPE html>
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

    <h3 style="margin:0 0 14px;color:#3A3228;font-size:15px;">Rapport généré par OpenAI :</h3>
    <div style="background:#FAF7F2;border-radius:10px;border:1px solid #E8E0D0;padding:22px;">
      ${reportToHtml(report)}
    </div>
  </div>
</body>
</html>`.trim();
}

export async function POST(req) {
  let supabase = null;
  let leftPath = null;
  let rightPath = null;

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json"))
      return NextResponse.json({ error: "Expected JSON body" }, { status: 415 });

    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

    leftPath = body?.leftPath;
    rightPath = body?.rightPath;
    const prenom = body?.prenom?.trim() || "";
    const nom = body?.nom?.trim() || "";
    const email = body?.email?.trim() || "";
    const dateNaissance = body?.dateNaissance?.trim() || "";
    const themeChoisi = body?.themeChoisi?.trim() || "";

    if (!isNonEmptyString(leftPath) || !isNonEmptyString(rightPath))
      return NextResponse.json({ error: "leftPath et rightPath requis." }, { status: 400 });
    if (!prenom || !nom || !email || !dateNaissance)
      return NextResponse.json({ error: "Prénom, nom, email et date requis." }, { status: 400 });
    if (!themeChoisi)
      return NextResponse.json({ error: "Thème requis." }, { status: 400 });

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = getEnv("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey)
      return NextResponse.json({ error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant." }, { status: 500 });
    if (!openaiKey)
      return NextResponse.json({ error: "OPENAI_API_KEY manquant." }, { status: 500 });

    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // ── Téléchargement des images depuis Supabase ──
    const [leftBuf, rightBuf] = await Promise.all([
      downloadFromSupabase(supabase, leftPath),
      downloadFromSupabase(supabase, rightPath),
    ]);

    const leftMime = mimeFromPath(leftPath);
    const rightMime = mimeFromPath(rightPath);
    const leftB64 = leftBuf.toString("base64");
    const rightB64 = rightBuf.toString("base64");

    // ── Génération du rapport via OpenAI ──
    const openai = new OpenAI({ apiKey: openaiKey, timeout: 55000 });
    const report = await generateReport(openai, prenom, nom, dateNaissance, themeChoisi, leftB64, rightB64, leftMime, rightMime);

    // ── Envoi des deux emails en parallèle ──
    const resend = getResendClient();
    const [clientMail, adminMail] = await Promise.all([
      resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `Votre analyse de ligne de vie — ${prenom}`,
        html: clientEmailHtml(prenom, report),
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `[ADMIN] Nouvelle analyse — ${prenom} ${nom}`,
        html: adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report),
      }),
    ]);

    if (clientMail.error) console.error("Resend client error:", clientMail.error);
    if (adminMail.error) console.error("Resend admin error:", adminMail.error);

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("Analyze error:", e);
    return NextResponse.json(
      { error: "Analyse échouée", details: String(e?.message || e) },
      { status: 500 }
    );
  } finally {
    if (supabase && leftPath && rightPath) {
      await deleteFromSupabase(supabase, [leftPath, rightPath]);
    }
  }
}
