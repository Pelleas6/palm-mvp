export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const BUCKET = "palm-uploads";

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

async function downloadFromSupabase(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Supabase download error: ${error.message}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

async function deleteFromSupabase(supabase, paths) {
  const validPaths = paths.filter(p => typeof p === "string" && p.trim().length > 0);
  if (validPaths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(validPaths);
  if (error) {
    console.warn(`Supabase delete warning: ${error.message}`);
  }
}

export async function POST(req) {
  let supabase = null;
  let leftPath = null;
  let rightPath = null;

  try {
    // ✅ Secret token
    const apiSecret = getEnv("API_SECRET");
    const headerSecret = req.headers.get("x-api-secret");
    if (apiSecret && headerSecret !== apiSecret) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 401 });
    }

    // ✅ Rate limiting
    const redisUrl = getEnv("UPSTASH_REDIS_REST_URL");
    const redisToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: false,
      });
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Trop de demandes. Réessayez dans une heure." },
          { status: 429 }
        );
      }
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Expected JSON body" },
        { status: 415 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON." },
        { status: 400 }
      );
    }

    leftPath = body?.leftPath;
    rightPath = body?.rightPath;
    const prenom = body?.prenom?.trim() || "";
    const nom = body?.nom?.trim() || "";
    const dateNaissance = body?.dateNaissance?.trim() || "";

    if (!isNonEmptyString(leftPath) || !isNonEmptyString(rightPath)) {
      return NextResponse.json(
        { error: "Il faut 2 chemins: leftPath et rightPath." },
        { status: 400 }
      );
    }

    if (!prenom || !nom || !dateNaissance) {
      return NextResponse.json(
        { error: "Il faut prénom, nom et date de naissance." },
        { status: 400 }
      );
    }

    const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseKey =
      getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
      getEnv("SUPABASE_ANON_KEY") ||
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const openaiKey = getEnv("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_*_KEY in env" },
        { status: 500 }
      );
    }
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in env" },
        { status: 500 }
      );
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    const leftBuf = await downloadFromSupabase(supabase, leftPath);
    const rightBuf = await downloadFromSupabase(supabase, rightPath);

    const leftMime = mimeFromPath(leftPath);
    const rightMime = mimeFromPath(rightPath);

    const leftB64 = leftBuf.toString("base64");
    const rightB64 = rightBuf.toString("base64");

    const client = new OpenAI({ apiKey: openaiKey, timeout: 45000 });

    const age = calculerAge(dateNaissance);
    const tranche = trancheAge(age);
    const civilite = `${prenom} ${nom}`;

    const prompt = `Tu es un chiromancien professionnel avec 20 ans d'expérience, formé aux traditions occidentale et orientale. Tu analyses les mains avec rigueur, précision et bienveillance.

Tu reçois deux photos : la main gauche et la main droite de ${civilite}.

CONTEXTE CONFIDENTIEL (n'utilise jamais ces données brutes dans le rapport) :
- La personne est ${tranche}.
- Calibre toute ton analyse en fonction de cette phase de vie. Les lignes d'une main jeune sont en évolution, celles d'une main mature sont plus définies et révélatrices du vécu réel.
- Ne mentionne jamais l'âge, la date de naissance ou ces informations brutes dans le rapport.

Rédige un rapport complet, structuré et personnalisé en français. Ton ton est sérieux, professionnel et légèrement chaleureux. Tu vouvoies toujours la personne et tu l'appelles "Madame/Monsieur ${nom}" quand c'est naturel.

RÈGLES ABSOLUES :
- Ne parle jamais de santé, maladie, diagnostic médical ou espérance de vie.
- Interdiction d'inventer : si un détail n'est pas clairement visible sur la photo, écrivez-le explicitement (ex : "non visible avec certitude") et ne l'interprétez pas.
- Avant toute interprétation, commence chaque section par une courte description factuelle de ce que vous voyez (forme, profondeur, continuité, courbure, ruptures, bifurcations, etc.).
- Chaque section doit faire minimum 5 phrases.
- Zéro généralité vague : chaque affirmation doit être reliée à un indice visuel décrit dans le texte.
- Le rapport doit faire au moins 600 mots.
- Si la photo est trop floue, trop sombre, trop loin, ou si la paume n'est pas assez ouverte, ajoutez à la fin une section "Qualité des photos" avec 3 recommandations concrètes.

STRUCTURE OBLIGATOIRE (respecte exactement ces titres) :

## Synthèse
Vue d'ensemble des deux mains. Première impression globale. Caractère dominant qui se dégage. Décrivez au moins 3 indices visibles qui soutiennent cette synthèse.

## Main gauche — Le potentiel inné
Analyse détaillée : forme de la main, forme des doigts, ligne de cœur, ligne de tête, ligne de vie.
Pour chaque élément :
1) décrivez précisément ce que vous voyez,
2) donnez l'interprétation,
3) reliez l'interprétation à l'indice visuel.
Objectif : au moins 2 à 3 observations concrètes par élément SI c'est visible. Si ce n'est pas visible, dites-le clairement.

## Main droite — Le vécu et les choix
Même niveau de détail que la main gauche. Mettez en évidence ce qui a évolué par rapport au potentiel inné. N'affirmez un changement que si vous pouvez décrire une différence visible entre les deux photos.

## Comparaison — Ce que le temps a façonné
Comparez les deux mains point par point. Qu'est-ce qui a changé ? Qu'est-ce qui est resté stable ? Chaque comparaison doit mentionner l'indice sur chaque main.

## Points forts
3 à 5 points forts concrets, chacun expliqué en 2-3 phrases minimum. Basé uniquement sur ce que vous voyez.

## Points à travailler
3 à 5 axes de développement concrets, formulés de façon positive et constructive. Jamais négatif, jamais brutal.

## Conclusion
Synthèse chaleureuse et encourageante. Message personnalisé adressé à ${civilite}. Terminez sur une note d'ouverture et de confiance.

---
*Préparé avec soin par notre expert en chiromancie, 20 ans d'expérience dans le domaine.*`;

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

    const report = resp.output_text || "Aucun texte généré.";
    return NextResponse.json({ report }, { status: 200 });

  } catch (e) {
    return NextResponse.json(
      { error: "Analyze failed", details: String(e?.message || e) },
      { status: 500 }
    );
  } finally {
    if (supabase) {
      await deleteFromSupabase(supabase, [leftPath, rightPath]);
    }
  }
}
