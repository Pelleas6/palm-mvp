export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Expected JSON body: { leftPath, rightPath }" },
        { status: 415 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON. Expected body: { leftPath, rightPath }" },
        { status: 400 }
      );
    }

    leftPath = body?.leftPath;
    rightPath = body?.rightPath;

    if (!isNonEmptyString(leftPath) || !isNonEmptyString(rightPath)) {
      return NextResponse.json(
        { error: "Il faut 2 chemins: leftPath et rightPath.", received: body },
        { status: 400 }
      );
    }

    const supabaseUrl =
      getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
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

    const prompt = `Tu es un chiromancien professionnel avec 20 ans d'expérience, formé aux traditions occidentale et orientale. Tu analyses les mains avec rigueur, précision et bienveillance.
Tu reçois deux photos : la main gauche et la main droite d'une même personne.
Rédige un rapport complet, structuré et personnalisé en français. Ton ton est sérieux, professionnel et légèrement chaleureux. Tu vouvoies toujours la personne.
RÈGLES ABSOLUES :
- Ne parle jamais de santé, maladie, diagnostic médical ou espérance de vie.
- Interdiction d'inventer : si un détail n'est pas clairement visible sur la photo, vous devez l'écrire explicitement (ex : "non visible avec certitude") et ne pas l'interpréter.
- Avant toute interprétation, commence chaque section par une courte description factuelle de ce que vous voyez (forme, profondeur, continuité, courbure, ruptures, bifurcations, etc.).
- Chaque section doit faire minimum 5 phrases.
- Zéro généralité vague : chaque affirmation doit être reliée à un indice visuel décrit dans le texte.
- Le rapport doit faire au moins 600 mots.
- Si la photo est trop floue, trop sombre, trop loin, ou si la paume n'est pas assez ouverte, ajoutez à la fin une section "Qualité des photos" avec 3 recommandations concrètes (angle, lumière, focus, distance).
STRUCTURE OBLIGATOIRE (respecte exactement ces titres) :
## Synthèse
Vue d'ensemble des deux mains. Première impression globale. Caractère dominant qui se dégage. Décrivez au moins 3 indices visibles qui soutiennent cette synthèse.
## Main gauche — Le potentiel inné
Analyse détaillée : forme de la main, forme des doigts, ligne de cœur, ligne de tête, ligne de vie.
Pour chaque élément :
1) décrivez précisément ce que vous voyez,
2) donnez l'interprétation,
3) reliez l'interprétation à l'indice visuel.
Objectif : au moins 2 à 3 observations concrètes par élément SI c'est visible. Si ce n'est pas visible, dites-le clairement et n'inventez pas.
## Main droite — Le vécu et les choix
Même niveau de détail que la main gauche. Mettez en évidence ce qui a évolué par rapport au potentiel inné. N'affirmez un changement que si vous pouvez décrire une différence visible entre les deux photos.
## Comparaison — Ce que le temps a façonné
Comparez les deux mains point par point. Qu'est-ce qui a changé ? Qu'est-ce qui est resté stable ? Qu'est-ce que cela révèle sur le parcours de vie ? Chaque comparaison doit mentionner l'indice sur chaque main.
## Points forts
3 à 5 points forts concrets, chacun expliqué en 2-3 phrases minimum. Basé uniquement sur ce que vous voyez.
## Points à travailler
3 à 5 axes de développement concrets, formulés de façon positive et constructive. Jamais négatif, jamais brutal. Basé uniquement sur ce que vous voyez.
## Conclusion
Synthèse chaleureuse et encourageante. Message personnalisé basé sur l'ensemble de l'analyse. Terminez sur une note d'ouverture et de confiance.`;

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
