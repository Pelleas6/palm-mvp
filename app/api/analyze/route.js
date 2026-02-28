export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getResendClient } from "../../../lib/resend";

const BUCKET = "palm-uploads";
const ADMIN_EMAIL = "karim.soualem@gmail.com";
const FROM_EMAIL = "contact@ma-ligne-de-vie.fr";

// ─── MODE TEST ───────────────────────────────────────────────────────────────
// OpenAI désactivé — on teste uniquement le tuyau upload → email
// Pour activer l'IA : remplacer generateReport() par l'appel OpenAI
// ─────────────────────────────────────────────────────────────────────────────

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

async function deleteFromSupabase(supabase, paths) {
  const valid = paths.filter((p) => typeof p === "string" && p.trim().length > 0);
  if (!valid.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(valid);
  if (error) console.warn("Supabase delete warning:", error.message);
}

function generateTestReport(prenom, nom, themeChoisi) {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 RAPPORT DE TEST — ${prenom} ${nom}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thème choisi : ${themeChoisi}
Généré le    : ${new Date().toLocaleString("fr-FR")}

Ce rapport est en mode TEST.
L'analyse OpenAI n'est pas encore activée.

✅ Upload Supabase → OK
✅ API Analyze    → OK
✅ Email Resend   → En cours de vérification

Quand ce mail arrive correctement :
→ On branche OpenAI et c'est en production.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

function clientEmailHtml(prenom, report) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:32px;">🌿</span>
      <h1 style="margin:12px 0 4px;font-size:22px;color:#3A3228;">Ligne de Vie</h1>
      <p style="margin:0;font-size:13px;color:#7A6F65;">ma-ligne-de-vie.fr</p>
    </div>

    <div style="background:#fff;border-radius:16px;border:1px solid #E8E0D0;padding:32px 28px;margin-bottom:24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#3A3228;">Bonjour <strong>${prenom}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#7A6F65;line-height:1.7;">
        Votre demande a bien été reçue. Voici votre rapport personnalisé :
      </p>

      <div style="background:#FAF7F2;border-radius:12px;border:1px solid #E8E0D0;padding:24px;white-space:pre-wrap;font-size:14px;color:#3A3228;line-height:1.8;">
${report}
      </div>
    </div>

    <p style="text-align:center;font-size:11px;color:#7A6F65;line-height:1.6;">
      Vos photos ont été supprimées après traitement.<br>
      © 2026 Ligne de Vie · ma-ligne-de-vie.fr
    </p>
  </div>
</body>
</html>
  `.trim();
}

function adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #ddd;">
    <h2 style="margin:0 0 20px;color:#3A3228;">🔔 Nouvelle demande reçue</h2>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:8px;color:#7A6F65;width:140px;">Prénom / Nom</td><td style="padding:8px;font-weight:bold;color:#3A3228;">${prenom} ${nom}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;color:#7A6F65;">Email client</td><td style="padding:8px;color:#3A3228;">${email}</td></tr>
      <tr><td style="padding:8px;color:#7A6F65;">Date de naissance</td><td style="padding:8px;color:#3A3228;">${dateNaissance}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;color:#7A6F65;">Thème choisi</td><td style="padding:8px;color:#3A3228;">${themeChoisi}</td></tr>
    </table>

    <h3 style="margin:0 0 12px;color:#3A3228;font-size:15px;">Rapport généré :</h3>
    <div style="background:#FAF7F2;border-radius:8px;border:1px solid #E8E0D0;padding:20px;white-space:pre-wrap;font-size:13px;color:#3A3228;line-height:1.8;">
${report}
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function POST(req) {
  let supabase = null;
  let leftPath = null;
  let rightPath = null;

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Expected JSON body" }, { status: 415 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

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

    const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey)
      return NextResponse.json({ error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant." }, { status: 500 });

    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // ── Génération du rapport (TEST — remplacer par OpenAI plus tard) ──
    const report = generateTestReport(prenom, nom, themeChoisi);

    // ── Envoi des emails ──
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
        subject: `[ADMIN] Nouvelle demande — ${prenom} ${nom}`,
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
