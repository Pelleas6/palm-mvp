import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const leftHand = formData.get("leftHand");
    const rightHand = formData.get("rightHand");

    if (!leftHand || !rightHand) {
      return new Response(JSON.stringify({ error: "Deux fichiers requis" }), {
        status: 400,
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const timestamp = Date.now();

    const { error: leftError } = await supabase.storage
      .from("palm-uploads")
      .upload(`left-${timestamp}.jpg`, leftHand);

    if (leftError) {
      return new Response(JSON.stringify({ error: leftError.message }), {
        status: 500,
      });
    }

    const { error: rightError } = await supabase.storage
      .from("palm-uploads")
      .upload(`right-${timestamp}.jpg`, rightHand);

    if (rightError) {
      return new Response(JSON.stringify({ error: rightError.message }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
