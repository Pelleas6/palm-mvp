diff --git a/app/api/process-job/route.js b/app/api/process-job/route.js
index d10852de38e39e5eaf0791b71d725d7febc56e0e..cca006253a9bfb49e7d1d8563b4efe66dac05741 100644
--- a/app/api/process-job/route.js
+++ b/app/api/process-job/route.js
@@ -1,43 +1,24 @@
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
 export const maxDuration = 60;
 
 import { NextResponse } from "next/server";
-import OpenAI from "openai";
-import { createClient } from "@supabase/supabase-js";
-import { getEnv } from "../../../lib/env";
-import { getResendClient } from "../../../lib/resend";
-import { generateReport, sendEmails, cleanupImages, invalidPhotoEmailHtml, ADMIN_EMAIL, FROM_EMAIL } from "../../../lib/report";
+import { processAnalyzePayload, processInvalidPhotosPayload } from "../../../lib/process-analysis";
 
 export async function POST(req) {
   try {
-    const body     = await req.json();
-    const resend   = getResendClient();
-    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
-    const openai   = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });
+    const body = await req.json();
 
     if (body.type === "invalid_photos") {
-      const { prenom, nom, email } = body;
-      await Promise.all([
-        resend.emails.send({ from: FROM_EMAIL, to: email,       subject: "Votre dossier Ligne de Vie",              html: invalidPhotoEmailHtml(prenom) }),
-        resend.emails.send({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: `⚠️ Photos invalides — ${prenom} ${nom}`, html: `<p style="font-family:sans-serif">Photos invalides — <strong>${prenom} ${nom}</strong> (${email})</p>` }),
-      ]);
-      return NextResponse.json({ ok: true }, { status: 200 });
+      const { status, payload } = await processInvalidPhotosPayload(body);
+      return NextResponse.json(payload, { status });
     }
 
-    const { prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath } = body;
-    if (!prenom || !email || !leftPath || !rightPath) {
-      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
-    }
-
-    const report = await generateReport(supabase, openai, prenom, dateNaissance, themeChoisi, leftPath, rightPath);
-    await sendEmails(resend, prenom, nom, email, dateNaissance, themeChoisi, report);
-    await cleanupImages(supabase, leftPath, rightPath);
-
-    return NextResponse.json({ ok: true }, { status: 200 });
+    const { status, payload } = await processAnalyzePayload(body);
+    return NextResponse.json(payload, { status });
 
   } catch (e) {
     console.error("process-job error:", e);
     return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
   }
 }
