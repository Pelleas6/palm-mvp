export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getResendClient } from "../../../lib/resend";

const FROM_EMAIL = "contact@ma-ligne-de-vie.fr";

const ALLOWED_DOMAINS = new Set([
  // International
  "gmail.com", "googlemail.com",
  "hotmail.com", "hotmail.fr", "hotmail.be", "hotmail.co.uk",
  "outlook.com", "outlook.fr", "outlook.be",
  "live.com", "live.fr", "live.be",
  "msn.com",
  "yahoo.com", "yahoo.fr", "yahoo.be", "yahoo.co.uk",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  // France
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "sfr.net",
  "laposte.net", "bbox.fr", "neuf.fr", "club-internet.fr",
  "numericable.fr", "bouyguestelecom.fr",
  // Autres pays courants
  "gmx.com", "gmx.fr", "gmx.net",
  "web.de", "t-online.de",
  "libero.it", "virgilio.it",
  "wp.pl", "o2.pl",
]);

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpEmailHtml(otp) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background:#FAF7F2; font-family:Georgia,serif; -webkit-text-size-adjust:100%; }
    .wrapper { width:100%; max-width:480px; margin:0 auto; padding:32px 16px; box-sizing:border-box; }
    .card { background:#fff; border-radius:12px; border:1px solid #E8E0D0; padding:32px 24px; text-align:center; }
    .otp { font-size:42px; font-weight:700; letter-spacing:10px; color:#3A3228; margin:24px 0; font-family:monospace; }
    .note { font-size:12px; color:#7A6F65; line-height:1.6; margin-top:16px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:26px;">🌿</div>
      <h1 style="margin:6px 0 2px;font-size:18px;color:#3A3228;">Ligne de Vie</h1>
    </div>
    <div class="card">
      <p style="margin:0 0 6px;font-size:15px;color:#3A3228;font-weight:600;">Votre code de vérification</p>
      <p style="margin:0;font-size:13px;color:#7A6F65;">Saisissez ce code pour confirmer votre email</p>
      <div class="otp">${otp}</div>
      <p class="note">Ce code est valable <strong>10 minutes</strong>.<br>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>
    <p style="text-align:center;font-size:11px;color:#7A6F65;margin-top:16px;">
      © 2026 Ligne de Vie · ma-ligne-de-vie.fr
    </p>
  </div>
</body>
</html>`.trim();
}

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }

    const email = (body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }

    const domain = email.split("@")[1];
    if (!ALLOWED_DOMAINS.has(domain)) {
      return NextResponse.json(
        { error: `Merci d'utiliser une adresse email personnelle valide (Gmail, Outlook, Yahoo…)` },
        { status: 422 }
      );
    }

    const redisUrl = getEnv("UPSTASH_REDIS_REST_URL");
    const redisToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
    if (!redisUrl || !redisToken) {
      return NextResponse.json({ error: "Configuration Redis manquante." }, { status: 500 });
    }

    const redis = new Redis({ url: redisUrl, token: redisToken });

    // Anti-spam : max 3 OTP par email par heure
    const spamKey = `otp_spam:${email}`;
    const spamCount = await redis.incr(spamKey);
    if (spamCount === 1) await redis.expire(spamKey, 3600);
    if (spamCount > 3) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans une heure." },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const otpKey = `otp:${email}`;
    await redis.set(otpKey, otp, { ex: 600 }); // expire dans 10 min

    const resend = getResendClient();
    const { error: mailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Votre code de vérification — Ligne de Vie",
      html: otpEmailHtml(otp),
    });

    if (mailError) {
      console.error("Resend OTP error:", mailError);
      return NextResponse.json({ error: "Erreur d'envoi email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("send-otp error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
