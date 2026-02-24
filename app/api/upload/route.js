export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const left = formData.get("leftHand");
    const right = formData.get("rightHand");

    // Juste pour tester que ça arrive bien
    console.log("UPLOAD TEST:", {
      hasLeft: !!left,
      hasRight: !!right,
      leftIsFile: left instanceof File,
      rightIsFile: right instanceof File,
      leftName: left?.name,
      rightName: right?.name,
    });

    return NextResponse.json({ ok: true, message: "API upload OK" });
  } catch (e) {
    console.error("UPLOAD TEST ERROR:", e);
    return NextResponse.json({ ok: false, error: "API upload failed" }, { status: 500 });
  }
}
