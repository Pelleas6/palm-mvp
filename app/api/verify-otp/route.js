export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
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

    const email = (body?.email || "").trim().toLowerCase();
    const code = (body?.code || "").trim();

    if (!email || !code) {
      return NextResponse.json({ error: "Email et code requis." }, { status: 400 });
    }

    const redisUrl = getEnv("UPSTASH_REDIS_REST_URL");
    const redisToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
    if (!redisUrl || !redisToken) {
      return NextResponse.json({ error: "Configuration Redis manquante." }, { status: 500 });
    }

    const redis = new Redis({ url: redisUrl, token: redisToken });

    // Anti brute-force : max 5 tentatives par email
    const attemptsKey = `otp_attempts:${email}`;
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, 600);
    if (attempts > 5) {
      return NextResponse.json(
        { error: "Trop de tentatives. Demandez un nouveau code." },
        { status: 429 }
      );
    }

    const otpKey = `otp:${email}`;
    const storedOtp = await redis.get(otpKey);

    if (!storedOtp) {
      return NextResponse.json(
        { error: "Code expiré. Demandez un nouveau code." },
        { status: 410 }
      );
    }

    if (String(storedOtp) !== String(code)) {
      return NextResponse.json(
        { error: "Code incorrect. Vérifiez et réessayez." },
        { status: 422 }
      );
    }

    // Code correct → on supprime pour usage unique + on marque l'email comme vérifié
    await redis.del(otpKey);
    await redis.del(attemptsKey);
    await redis.set(`otp_verified:${email}`, "1", { ex: 3600 }); // valide 1h

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("verify-otp error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
