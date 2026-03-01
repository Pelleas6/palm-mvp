export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

function getEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
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

    const redisUrl   = getEnv("UPSTASH_REDIS_REST_URL");
    const redisToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
    if (!redisUrl || !redisToken) return NextResponse.json({ error: "Redis non configuré." }, { status: 500 });

    // Vérifier OTP
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const verified = await redis.get(`otp_verified:${email}`);
    if (!verified) return NextResponse.json({ error: "Email non vérifié." }, { status: 403 });

    // Mode gratuit — on saute Stripe
    const paymentEnabled = getEnv("PAYMENT_ENABLED");
    if (paymentEnabled === "false") {
      await redis.del(`otp_verified:${email}`);
      // Stocker le job pour que le webhook-like handler l'analyse
      await redis.set(`free_job:${email}`, JSON.stringify({ prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath }), { ex: 3600 });
      // Déclencher l'analyse en arrière-plan via fetch interne
      const baseUrl = "https://ma-ligne-de-vie.fr";
      fetch(`${baseUrl}/api/process-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});
      return NextResponse.json({ free: true }, { status: 200 });
    }

    // Mode payant — créer session Stripe
    await redis.del(`otp_verified:${email}`); // consommer l'OTP vérifié
    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    if (!stripeSecret) return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });

    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: "Analyse de ligne de vie",
            description: `Rapport personnalisé — thème : ${themeChoisi}`,
          },
          unit_amount: 2999,
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: email,
      success_url: "https://ma-ligne-de-vie.fr/merci?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:  "https://ma-ligne-de-vie.fr/?cancelled=1",
      metadata: { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });

  } catch (e) {
    console.error("create-checkout error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
