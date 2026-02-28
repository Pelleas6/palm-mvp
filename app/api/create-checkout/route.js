export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    if (!stripeSecret) return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });

    const redisUrl  = getEnv("UPSTASH_REDIS_REST_URL");
    const redisToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
    if (!redisUrl || !redisToken) return NextResponse.json({ error: "Redis non configuré." }, { status: 500 });

    // Stocker les données dans Redis en attendant le paiement (expire 1h)
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const sessionData = { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath };

    // Créer session Stripe
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
          unit_amount: 2999, // 29,99€
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://ma-ligne-de-vie.fr"}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL || "https://ma-ligne-de-vie.fr"}/?cancelled=1`,
      metadata: { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath },
    });

    // Stocker les données liées à la session Stripe dans Redis
    await redis.set(`stripe_session:${session.id}`, JSON.stringify(sessionData), { ex: 3600 });

    return NextResponse.json({ url: session.url }, { status: 200 });

  } catch (e) {
    console.error("create-checkout error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
