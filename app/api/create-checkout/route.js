export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { Client as QStash } from "@upstash/qstash";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../../../lib/env.js";
import { mimeFromPath, BUCKET } from "../../../lib/report";

const BASE_URL = getEnv("SITE_URL") || "https://ma-ligne-de-vie.fr";
const DELAY_SECONDS = 0;

async function validateImages(openai, leftB64, rightB64, leftMime, rightMime) {
  const resp = await openai.chat.completions.create({
  model: "gpt-4o",
  max_tokens: 20,
    messages: [{
      role: "user",
      content: [
        { type: "text",      text: "Ces deux images montrent-elles des paumes de mains humaines clairement exploitables pour une lecture (peu importe l'ordre gauche/droite) ? Réponds uniquement par OUI ou NON." },
        { type: "image_url", image_url: { url: `data:${leftMime};base64,${leftB64}` } },
        { type: "image_url", image_url: { url: `data:${rightMime};base64,${rightB64}` } },
      ],
    }],
  });

  const answer = (resp.choices[0].message.content || "").trim().toUpperCase();
  if (answer.startsWith("NON")) return false;
  if (answer.startsWith("OUI")) return true;

  // En cas de réponse imprécise, on évite de bloquer à tort une analyse valide.
  return true;
}

export async function POST(req) {
  const redis = new Redis({ url: getEnv("KV_REST_API_URL"), token: getEnv("KV_REST_API_TOKEN") });
  const sessionId = req.cookies.get("palm_session")?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const origin = req.headers.get("origin") || req.headers.get("referer");
  const allowedOrigin = getEnv("SITE_URL") || "https://ma-ligne-de-vie.fr";
  if (origin && !origin.startsWith(allowedOrigin.replace(/\/$/, "")) && !origin.startsWith("http://localhost:")) {
     return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  try {
    let body;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }

    const { requestId, prenom, nom, dateNaissance, themeChoisi } = body;
    const requestData = await redis.get(`request:${requestId}`);
    if (!requestData) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const request = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    
    const sessionData = await redis.get(`session:${sessionId}`);
    const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
    
    if (request.email !== session.email) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"));
    const openai = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });

    const { data: leftData,  error: leftErr  } = await supabase.storage.from(BUCKET).download(request.leftPath);
    const { data: rightData, error: rightErr } = await supabase.storage.from(BUCKET).download(request.rightPath);
    if (leftErr || rightErr) return NextResponse.json({ error: "Erreur lecture images." }, { status: 500 });

    const leftB64   = Buffer.from(await leftData.arrayBuffer()).toString("base64");
    const rightB64  = Buffer.from(await rightData.arrayBuffer()).toString("base64");
    const leftMime  = mimeFromPath(request.leftPath);
    const rightMime = mimeFromPath(request.rightPath);

    let imagesValides = true;
    try {
      imagesValides = await validateImages(openai, leftB64, rightB64, leftMime, rightMime);
    } catch (e) {
      console.error("Validation IA photos échouée, passage en mode permissif:", e);
      imagesValides = true;
    }

    if (!imagesValides) {
      await Promise.allSettled([
        supabase.storage.from(BUCKET).remove([request.leftPath]),
        supabase.storage.from(BUCKET).remove([request.rightPath]),
      ]);
      return NextResponse.json({ free: true }, { status: 200 });
    }

    const paymentEnabled = getEnv("PAYMENT_ENABLED");
    if (paymentEnabled === "false") {
      const qstash = new QStash({ token: getEnv("QSTASH_TOKEN") });
      await qstash.publishJSON({
        url: `${BASE_URL}/api/process-job`,
        body: { type: "analyze", prenom, nom, email: request.email, dateNaissance, themeChoisi, leftPath: request.leftPath, rightPath: request.rightPath },
        delay: DELAY_SECONDS,
      });
      return NextResponse.json({ free: true }, { status: 200 });
    }

    const stripe  = new Stripe(getEnv("STRIPE_SECRET_KEY"));
    const session_stripe = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price: getEnv("STRIPE_PRICE_ID"),
        quantity: 1,
      }],
      mode: "payment",
      customer_email: request.email,
      success_url: `${BASE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/?cancelled=1`,
      metadata: { requestId },
    });

    return NextResponse.json({ url: session_stripe.url }, { status: 200 });

  } catch (e) {
    console.error("create-checkout error:", e);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
