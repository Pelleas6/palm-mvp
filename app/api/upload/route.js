import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getExtFromMime(mime) {
  if (!mime) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function POST(req) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || "palm-uploads";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans Vercel." }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!left || !right) {
      return new Response(
        JSON.stringify({ error: "Fichiers manquants (leftHand/rightHand)." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Les fichiers reçus sont des File (web standard)
    const now = Date.now();
    const baseFolder = `orders/${now}`;

    const leftExt = getExtFromMime(left.type);
    const rightExt = getExtFromMime(right.type);

    const leftPath = `${baseFolder}/left.${leftExt}`;
    const rightPath = `${baseFolder}/right.${rightExt}`;

    // Convertit en ArrayBuffer pour upload
    const leftBuf = Buffer.from(await left.arrayBuffer());
    const rightBuf = Buffer.from(await right.arrayBuffer());

    const { error: leftErr } = await supabase.storage
      .from(bucket)
      .upload(leftPath, leftBuf, {
        contentType: left.type || "image/jpeg",
        upsert: false,
      });

    if (leftErr) {
      return new Response(
        JSON.stringify({ error: `Supabase upload left: ${leftErr.message}` }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const { error: rightErr } = await supabase.storage
      .from(bucket)
      .upload(rightPath, rightBuf, {
        contentType: right.type || "image/jpeg",
        upsert: false,
      });

    if (rightErr) {
      return new Response(
        JSON.stringify({ error: `Supabase upload right: ${rightErr.message}` }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Upload OK vers Supabase",
        bucket,
        leftPath,
        rightPath,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message || "Erreur serveur inconnue" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
