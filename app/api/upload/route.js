import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    console.log("API UPLOAD APPELÉ");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log("ENV MANQUANTES", {
        hasUrl: !!SUPABASE_URL,
        hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Variables d'environnement manquantes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    if (!left || !right) {
      return new Response(
        JSON.stringify({ ok: false, error: "Il faut 2 fichiers : main gauche + main droite." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (!(left instanceof File) || !(right instanceof File)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Fichiers invalides." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const bucket = "hands"; // mets ici le nom exact de ton bucket
    const runId = crypto.randomUUID();
    const now = new Date().toISOString().replace(/[:.]/g, "-");

    async function uploadOne(file, label) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${runId}/${label}-${now}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (error) throw new Error(`Supabase upload error (${label}): ${error.message}`);

      return { path: data.path };
    }

    const leftUp = await uploadOne(left, "left");
    const rightUp = await uploadOne(right, "right");

    console.log("UPLOAD OK", { left: leftUp.path, right: rightUp.path });

    return new Response(
      JSON.stringify({
        ok: true,
        runId,
        leftPath: leftUp.path,
        rightPath: rightUp.path,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    console.log("UPLOAD FAIL", String(e?.message || e));
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
