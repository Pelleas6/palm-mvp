import { getEnv } from "./env.js";

export const BUCKET      = "palm-uploads";
export const ADMIN_EMAIL = "karim.soualem@gmail.com";
export const FROM_EMAIL  = "contact@ma-ligne-de-vie.fr";

export function mimeFromPath(path) {
  const p = (path || "").toLowerCase();
  if (p.endsWith(".png"))  return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function calculerAge(dateNaissance) {
  const naissance = new Date(dateNaissance);
  const aujourd = new Date();
  let age = aujourd.getFullYear() - naissance.getFullYear();
  const m = aujourd.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && aujourd.getDate() < naissance.getDate())) age--;
  return age;
}

const THEME_LABELS = {
  amour:         "Vie affective & Relations",
  travail:       "Trajectoire professionnelle & Aptitudes",
  developpement: "Caractère profond & Constitution intérieure",
  finances:      "Vitalité, cycles d'énergie & Ressources",
  famille:       "Liens, transmission & Vie relationnelle",
};

export function labelTheme(themeId) {
  return THEME_LABELS[themeId] || "Lecture complète & équilibrée";
}

export function buildSystemPrompt() {
  return `Tu es un analyste spécialisé dans l’étude symbolique des lignes, formes et reliefs de la main.

À partir des deux images fournies (main gauche et main droite), réalise une analyse approfondie, structurée et nuancée.

Important :

- Ne fais aucune prédiction médicale.
- Ne mentionne aucune maladie.
- Ne parle pas de mort.
- Ne formule aucune certitude absolue.
- Présente l’analyse comme une lecture symbolique et introspective.
- Utilise un ton posé, clair, professionnel et bienveillant.
- L’objectif est d’offrir un éclairage sur les dynamiques personnelles, les forces et les axes d’évolution.

Structure attendue :

1) Vue d’ensemble
Commence par une lecture globale donnant une première impression de la dynamique générale.

2) Main gauche – Fondations intérieures
Analyse les tendances naturelles, la sensibilité profonde et les traits de base.
Observe et décris :
- La ligne de vie (forme, profondeur, continuité)
- La ligne de tête
- La ligne de cœur
- Les autres éléments remarquables (reliefs, intersections, cohérence générale)

3) Main droite – Expression actuelle
Analyse comment la personnalité s’exprime aujourd’hui et comment les tendances se traduisent concrètement.
Observe et décris :
- La ligne de vie
- La ligne de tête
- La ligne de cœur
- Les éléments complémentaires significatifs

4) Forces dominantes
Identifie les points d’appui et les ressources personnelles mises en évidence.

5) Axes d’évolution
Décris les ajustements ou équilibres possibles de manière constructive.

6) Cohérence globale
Compare les deux mains et explique la relation entre potentiel intérieur et expression actuelle.

7) Synthèse finale
Termine par une conclusion claire, inspirante et constructive.

Consignes supplémentaires :

- Évite toute formulation déterministe.
- Ne parle pas d’événements futurs précis.
- Ne donne pas de dates.
- Reste dans un cadre d’analyse symbolique orientée développement personnel.
- Rédige un texte fluide, premium, riche mais naturel.
- Évite les répétitions.
- Ne fais pas référence aux consignes dans la réponse finale.
- Réponds en français uniquement.

## FORMAT DE SORTIE

Texte Markdown. Titres avec ## pour chaque section. Commence directement par l'observation, sans introduction du système. Pas de conclusion du type "J'espère que..." — cela est ajouté séparément.`;
}

export function buildUserPrompt(prenom, dateNaissance, themeChoisi) {
  const age   = calculerAge(dateNaissance);
  const theme = labelTheme(themeChoisi);

  return `Voici les informations du client :

Prénom : ${prenom}
Âge : ${age} ans
Thème prioritaire demandé : ${theme}

Les deux images jointes sont : main gauche (1ère image), main droite (2ème image).

Produis une analyse complète selon les instructions. Commence directement par l'observation. Adresse-toi à ${prenom} par son prénom dès le premier paragraphe. Accorde une attention particulière à la section "${theme}" qui est le thème choisi par ${prenom}.`;
}

export async function generateReport(supabase, openai, prenom, dateNaissance, themeChoisi, leftPath, rightPath) {
  const leftMime  = mimeFromPath(leftPath);
  const rightMime = mimeFromPath(rightPath);

  const { data: leftData,  error: leftErr  } = await supabase.storage.from(BUCKET).download(leftPath);
  const { data: rightData, error: rightErr } = await supabase.storage.from(BUCKET).download(rightPath);
  if (leftErr || rightErr) throw new Error("Erreur download Supabase");

  const leftB64  = Buffer.from(await leftData.arrayBuffer()).toString("base64");
  const rightB64 = Buffer.from(await rightData.arrayBuffer()).toString("base64");

  const resp = await openai.responses.create({
    model: "gpt-4o",
    max_output_tokens: 2000,
    instructions: buildSystemPrompt(),
    input: [{
      role: "user",
      content: [
        { type: "input_text",  text: buildUserPrompt(prenom, dateNaissance, themeChoisi) },
        { type: "input_text",  text: "Photo main gauche :" },
        { type: "input_image", image_url: `data:${leftMime};base64,${leftB64}`, detail: "high" },
        { type: "input_text",  text: "Photo main droite :" },
        { type: "input_image", image_url: `data:${rightMime};base64,${rightB64}`, detail: "high" },
      ],
    }],
  });

  return resp.output_text || "Aucun texte généré.";
}

export function reportToHtml(report) {
  return report.split("\n").map((l) => {
    if (l.startsWith("## ")) return `<h2 class="rh2">${l.slice(3)}</h2>`;
    if (l.startsWith("---"))  return `<hr class="rhr">`;
    if (l.startsWith("*") && l.endsWith("*")) return `<p class="rit">${l.replace(/\*/g,"")}</p>`;
    if (!l.trim()) return "";
    return `<p class="rp">${l}</p>`;
  }).join("");
}

export function clientEmailHtml(prenom, report) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#fff;font-family:Georgia,serif;-webkit-text-size-adjust:100%;color:#3A3228}
  .w{max-width:580px;margin:0 auto;padding:32px 24px;box-sizing:border-box}
  .rh2{font-size:15px;font-weight:700;color:#3A3228;margin:28px 0 6px;padding-bottom:6px;border-bottom:1px solid #C9A84C;letter-spacing:.03em}
  .rhr{border:none;border-top:1px solid #E8E0D0;margin:24px 0}
  .rit{font-style:italic;color:#7A6F65;font-size:12px;margin:16px 0 0}
  .rp{margin:0 0 14px;font-size:15px;color:#3A3228;line-height:1.85;word-break:break-word}
  @media(max-width:480px){.w{padding:20px 16px}}
</style>
</head>
<body>
<div class="w">
  <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #E8E0D0">
    <div style="font-size:26px;margin-bottom:10px">🌿</div>
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;margin-bottom:6px">Ligne de Vie</div>
    <div style="font-size:11px;color:#7A6F65">ma-ligne-de-vie.fr</div>
  </div>
  <p style="margin:0 0 6px;font-size:17px">Bonjour <strong>${prenom}</strong>,</p>
  <p style="margin:0 0 32px;font-size:14px;color:#7A6F65;line-height:1.7">Veuillez trouver ci-dessous votre analyse personnalisée.</p>
  ${reportToHtml(report)}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E0D0">
    <p style="margin:0;font-size:12px;color:#7A6F65;line-height:1.7">Vos photos ont été supprimées de nos serveurs après traitement.<br>Ce rapport est strictement personnel et confidentiel.</p>
  </div>
  <p style="margin:28px 0 0;font-size:11px;color:#7A6F65;text-align:center;letter-spacing:.04em">© 2026 Ligne de Vie · Confidentiel · Personnalisé · Sérieux</p>
</div>
</body>
</html>`.trim();
}

export function adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #ddd;">
    <h2 style="margin:0 0 20px;color:#3A3228;font-size:18px;">🔔 Nouvelle analyse — ${prenom} ${nom}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
      <tr><td style="padding:10px 8px;color:#7A6F65;width:140px;border-bottom:1px solid #eee;">Prénom / Nom</td><td style="padding:10px 8px;font-weight:bold;border-bottom:1px solid #eee;">${prenom} ${nom}</td></tr>
      <tr><td style="padding:10px 8px;color:#7A6F65;border-bottom:1px solid #eee;">Email</td><td style="padding:10px 8px;border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#7A9E7E;">${email}</a></td></tr>
      <tr><td style="padding:10px 8px;color:#7A6F65;border-bottom:1px solid #eee;">Naissance</td><td style="padding:10px 8px;border-bottom:1px solid #eee;">${dateNaissance}</td></tr>
      <tr><td style="padding:10px 8px;color:#7A6F65;">Thème</td><td style="padding:10px 8px;">${themeChoisi}</td></tr>
    </table>
    <div style="font-size:13px;color:#3A3228;line-height:1.7;white-space:pre-wrap;">${report}</div>
  </div>
</body>
</html>`.trim();
}

export function invalidPhotoEmailHtml(prenom) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#fff;font-family:Georgia,serif;color:#3A3228}
  .w{max-width:580px;margin:0 auto;padding:32px 24px;box-sizing:border-box}
</style>
</head>
<body>
<div class="w">
  <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #E8E0D0">
    <div style="font-size:26px;margin-bottom:10px">🌿</div>
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;margin-bottom:6px">Ligne de Vie</div>
    <div style="font-size:11px;color:#7A6F65">ma-ligne-de-vie.fr</div>
  </div>
  <p style="margin:0 0 6px;font-size:17px">Bonjour <strong>${prenom}</strong>,</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.85">Nous avons bien reçu votre dossier, mais les photos transmises ne nous ont pas permis de réaliser votre analyse dans les meilleures conditions.</p>
  <p style="margin:0 0 32px;font-size:15px;line-height:1.85">Merci de nous recontacter avec des photos de vos paumes de mains gauche et droite bien visibles.</p>
  <div style="background:#FBF6EC;border-radius:10px;border:1px solid #E8D9B0;padding:16px 18px;margin-bottom:32px">
    <p style="margin:0;font-size:13px;color:#7A6F65;line-height:1.7">💡 Conseil : paume ouverte face à l'objectif, lumière naturelle, fond neutre, lignes bien visibles.</p>
  </div>
  <div style="padding-top:20px;border-top:1px solid #E8E0D0">
    <p style="margin:0;font-size:13px;color:#7A6F65;line-height:1.7;font-style:italic">Nous restons à votre disposition.<br><strong>Votre expert — Ligne de Vie 🌿</strong></p>
  </div>
</div>
</body>
</html>`.trim();
}

export async function sendEmails(resend, prenom, nom, email, dateNaissance, themeChoisi, report) {
  await Promise.all([
    resend.emails.send({ from: FROM_EMAIL, to: email,       subject: "Votre analyse de ligne de vie",        html: clientEmailHtml(prenom, report) }),
    resend.emails.send({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: `Nouvelle analyse — ${prenom} ${nom}`, html: adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report) }),
  ]);
}

export async function cleanupImages(supabase, leftPath, rightPath) {
  await Promise.allSettled([
    supabase.storage.from(BUCKET).remove([leftPath]),
    supabase.storage.from(BUCKET).remove([rightPath]),
  ]);
}
