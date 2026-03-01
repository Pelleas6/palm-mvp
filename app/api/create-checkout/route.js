export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { Client as QStash } from "@upstash/qstash";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../../../lib/env";
import { mimeFromPath, BUCKET } from "../../../lib/report";

const BASE_URL = "https://ma-ligne-de-vie.fr";

// 0 = immédiat (test), 86400 = 24h (prod)
const DELAY_SECONDS = 0;

async function validateImages(openai, leftB64, rightB64, leftMime, rightMime) {
  const resp = await openai.responses.create({
    model: "gpt-4.1-mini",
    max_output_tokens: 16,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: "Ces deux images montrent-elles bien des paumes de mains humaines (une main gauche et une main droite) ? Réponds uniquement par OUI ou NON." },
        { type: "input_image", image_url: `data:${leftMime};base64,${leftB64}` },
        { type: "input_image", image_url: `data:${rightMime};base64,${rightB64}` },
      ],
    }],
  });
  return (resp.output_text || "").trim().toUpperCase().startsWith("OUI");
}

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }

    const { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath } = body;
    if (!prenom || !nom || !email || !dateNaissance || !themeChoisi || !leftPath || !rightPath) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
    }

    // Vérifier OTP (désactivé temporairement)
    const redis = new Redis({ url: getEnv("UPSTASH_REDIS_REST_URL"), token: getEnv("UPSTASH_REDIS_REST_TOKEN") });
    // const verified = await redis.get(`otp_verified:${email}`);
    // if (!verified) return NextResponse.json({ error: "Email non vérifié." }, { status: 403 });

    // Valider les images
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const openai   = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });

    const { data: leftData,  error: leftErr  } = await supabase.storage.from(BUCKET).download(leftPath);
    const { data: rightData, error: rightErr } = await supabase.storage.from(BUCKET).download(rightPath);
    if (leftErr || rightErr) return NextResponse.json({ error: "Erreur lecture images." }, { status: 500 });

    const leftB64   = Buffer.from(await leftData.arrayBuffer()).toString("base64");
    const rightB64  = Buffer.from(await rightData.arrayBuffer()).toString("base64");
    const leftMime  = mimeFromPath(leftPath);
    const rightMime = mimeFromPath(rightPath);

    const imagesValides = await validateImages(openai, leftB64, rightB64, leftMime, rightMime);

    if (!imagesValides) {
      await Promise.allSettled([
        supabase.storage.from(BUCKET).remove([leftPath]),
        supabase.storage.from(BUCKET).remove([rightPath]),
      ]);
      const qstash = new QStash({ token: getEnv("QSTASH_TOKEN") });
      await qstash.publishJSON({
        url: `${BASE_URL}/api/process-job`,
        body: { type: "invalid_photos", prenom, nom, email },
        delay: 0,
      });
      return NextResponse.json({ free: true }, { status: 200 });
    }

    // Images valides — consommer OTP
    await redis.del(`otp_verified:${email}`);

    // Mode gratuit — publier job QStash
    const paymentEnabled = getEnv("PAYMENT_ENABLED");
    if (paymentEnabled === "false") {
      const qstash = new QStash({ token: getEnv("QSTASH_TOKEN") });
      await qstash.publishJSON({
        url: `${BASE_URL}/api/process-job`,
        body: { type: "analyze", prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath },
        delay: DELAY_SECONDS,
      });
      return NextResponse.json({ free: true }, { status: 200 });
    }

    // Mode payant — créer session Stripe
    const stripe  = new Stripe(getEnv("STRIPE_SECRET_KEY"));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: "Analyse de ligne de vie", description: `Rapport personnalisé — thème : ${themeChoisi}` },
          unit_amount: 2999,
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: email,
      success_url: `${BASE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/?cancelled=1`,
      metadata: { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });

  } catch (e) {
    console.error("create-checkout error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
