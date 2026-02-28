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

  const prompt = `Tu es un expert en analyse morphologique des mains, formé à la dermato-morphologie et à la psychologie des formes. Tu rédiges des rapports d'introspection personnalisés à partir de l'observation visuelle des mains, en t'appuyant sur des caractéristiques morphologiques objectives (forme, lignes, reliefs, proportions).

Tu reçois deux photos des mains de ${civilite} : la main gauche (traits de caractère naturels, tempérament de base) et la main droite (traits développés, vécu, adaptations).

CONTEXTE (usage interne uniquement — ne jamais mentionner dans le rapport) :
- Profil de vie : ${tranche}.
- Adapte la tonalité et la profondeur du rapport à ce profil.
- N'écris jamais l'âge, la date de naissance ni aucune donnée brute dans le rapport.

ANGLE D'ANALYSE CHOISI : ${focusTheme}
- Oriente toutes les observations morphologiques autour de cet angle.
- Chaque élément visuel observé doit être interprété sous ce prisme uniquement.

Rédige un rapport d'introspection complet, structuré et personnalisé en français. Le ton est bienveillant, précis et professionnel. Tu vouvoies toujours ${civilite} et tu l'appelles par son prénom quand c'est naturel.

RÈGLES ABSOLUES :
- Aucune référence à la santé, aux maladies, au diagnostic médical ou à la durée de vie.
- Interdiction d'inventer : si un détail n'est pas clairement visible sur la photo, dis-le explicitement ("non visible avec certitude") et n'interprète pas ce qui n'est pas observable.
- Commence chaque section par une description factuelle de ce que tu observes visuellement, puis interprète.
- Chaque section : minimum 5 phrases.
- Zéro généralité : chaque interprétation doit être reliée à un indice morphologique visible.
- Minimum 600 mots au total.
- Si une photo est trop floue ou la paume insuffisamment ouverte, ajoute une section "Qualité des photos" avec 3 recommandations concrètes.

STRUCTURE OBLIGATOIRE :

## Synthèse
Vue d'ensemble des deux mains orientée vers l'angle d'analyse choisi. Cite au moins 3 indices morphologiques visibles qui soutiennent cette synthèse.

## Main gauche — Traits naturels et tempérament de base
Analyse morphologique détaillée orientée ${focusTheme}. Pour chaque élément observé : décris, interprète, relie à l'indice visuel.

## Main droite — Traits développés et vécu
Même niveau de détail. Mets en évidence ce qui a évolué ou s'est renforcé par rapport aux traits naturels, dans le contexte de l'angle choisi.

## Comparaison — Ce que le parcours a façonné
Compare les deux mains dans le contexte de l'angle choisi. Chaque point de comparaison mentionne l'indice observé sur chaque main.

## Points forts
3 à 5 points forts concrets liés à l'angle choisi, chacun expliqué en 2-3 phrases avec l'indice morphologique associé.

## Points à développer
3 à 5 axes de progression concrets liés à l'angle choisi. Formulé de manière positive et constructive.

## Conclusion
Synthèse chaleureuse adressée à ${civilite}, orientée vers l'angle choisi. Termine sur une note d'ouverture et de confiance en l'avenir.

---
*Rapport d'analyse morphologique préparé avec soin.*`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    max_output_tokens: 4000,
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

  return resp.output_text || "Aucun texte généré.";
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
