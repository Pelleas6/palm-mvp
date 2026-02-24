import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const formData = await request.formData();

    const leftHand = formData.get("leftHand");
    const rightHand = formData.get("rightHand");

    if (!leftHand || !rightHand) {
      return NextResponse.json(
        { error: "Les deux fichiers sont requis." },
        { status: 400 }
      );
    }

    console.log("Fichiers reçus");

    return NextResponse.json({
      success: true,
      message: "Upload reçu côté serveur"
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
