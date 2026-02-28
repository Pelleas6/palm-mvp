export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";

export async function POST(req) {
  try {
    const { to } = await req.json();

    if (!to) {
      return NextResponse.json(
        { error: "Email destinataire manquant" },
        { status: 400 }
      );
    }

    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: "Lecture de Main <contact@ma-ligne-de-vie.fr>",
      to,
      subject: "Test Resend",
      html: "<p>Si tu reçois cet email, Resend fonctionne correctement.</p>",
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
