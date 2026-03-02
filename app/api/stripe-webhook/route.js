export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../../../lib/env";
import { getResendClient } from "../../../lib/resend";
import { generateReport, sendEmails, cleanupImages } from "../../../lib/report";

export async function POST(req) {
  const stripeSecret  = getEnv("STRIPE_SECRET_KEY");
  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const body   = await req.text();
  const sig    = req.headers.get("stripe-signature");

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
    console.error("Metadata manquante dans la session Stripe:", session.id);
    return NextResponse.json({ error: "Metadata manquante." }, { status: 400 });
  }

  const redis = new Redis({ url: getEnv("UPSTASH_REDIS_REST_URL"), token: getEnv("UPSTASH_REDIS_REST_TOKEN") });

  // Idempotence — évite les doublons si Stripe rejoue le webhook
  const doneKey    = `stripe_done:${session.id}`;
  const alreadyDone = await redis.get(doneKey);
  if (alreadyDone) {
    console.log("Webhook déjà traité:", session.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  await redis.set(doneKey, "1", { ex: 86400 * 7 }); // garde 7 jours

  try {
    // Vérifier OTP
    const verified = await redis.get(`otp_verified:${email}`);
    if (!verified) {
      console.error("Email non vérifié par OTP :", email);
      return NextResponse.json({ error: "Email non vérifié." }, { status: 403 });
    }
    await redis.del(`otp_verified:${email}`);

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const openai   = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });
    const resend   = getResendClient();

    const report = await generateReport(supabase, openai, prenom, dateNaissance, themeChoisi, leftPath, rightPath);
    await sendEmails(resend, prenom, nom, email, dateNaissance, themeChoisi, report);
    await cleanupImages(supabase, leftPath, rightPath);

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("Webhook analyze error:", e);
    // En cas d'erreur, on supprime la clé d'idempotence pour que Stripe puisse retenter
    await redis.del(doneKey);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
