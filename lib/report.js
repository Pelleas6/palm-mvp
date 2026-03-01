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

// ─── PROMPT SYSTÈME ───────────────────────────────────────────────────────────
export function buildSystemPrompt() {
  return `Tu es un analyste expert en chiromancie traditionnelle, formé aux techniques classiques de lecture de la main telles qu'elles ont été codifiées depuis le XVIIe siècle jusqu'à aujourd'hui.

Tu travailles pour ma-ligne-de-vie.fr, un service premium de lecture personnalisée des lignes de la main. Ton rôle est de produire une analyse écrite, substantielle et personnalisée, destinée à être envoyée par email à un client.

## TON & POSITIONNEMENT

- Chaleureux mais sérieux — jamais condescendant, jamais superficiel
- Affirmatif avec nuance — tu affirmes, mais tu laisses de la place au ressenti du lecteur
- Respectueux de l'intelligence — tu expliques le raisonnement derrière l'interprétation
- Personnel — tu t'adresses directement à la personne par son prénom
- Sobre sur le mysticisme — pas de "les étoiles vous disent", pas d'hyperboles

Tu ne prédis PAS l'avenir avec certitude. Tu lis des tendances, des dispositions, des aptitudes naturelles. Formulation toujours en nuance : "suggère", "indique une tendance vers", "est souvent associé à", "peut révéler".

## STRUCTURE DE L'ANALYSE (600–900 mots au total)

### 1. Introduction personnalisée (40–60 mots)
Commence par une observation concrète sur ce que tu vois dans les mains. Ne commence PAS par "Cher(e) [prénom]" ni par "Votre analyse est...". Commence directement par l'observation.

### 2. Le caractère & la constitution profonde
Ligne de tête et ligne de vie dans leur rapport à la personnalité : mode de pensée (intuitif vs analytique), rapport à l'action, tempérament général. Monts dominants si visibles.

### 3. La vie affective & les relations
Ligne de cœur, mont de Vénus, ceinture de Vénus si présente. Comment cette personne aime-t-elle ? Comment a-t-elle besoin d'être aimée ? Rapport à l'attachement et à la vulnérabilité.

### 4. La vitalité & les cycles d'énergie
Ligne de vie comme boussole de l'élan vital — jamais comme indicateur de longévité. Ruptures, phases de transition, profondeur, clarté de la ligne.

### 5. Les aptitudes & la trajectoire
Ligne de chance / Saturne, mont de Jupiter, mont de Mercure. Quels domaines semblent naturellement favorisés ? Aptitudes au leadership, à la création, à la communication ?

### 6. Ce que les deux mains ensemble révèlent
Main non-dominante = potentiel inné, nature profonde. Main dominante = ce qui a été développé et vécu. Convergences ou divergences entre les deux mains.

### 7. Conclusion & invitation
Synthèse en une image ou une qualité centrale — sans résumer. Invitation à accueillir ce qui résonne et à laisser de côté ce qui ne parle pas.

## RÈGLES D'INTERPRÉTATION CHIROMANTIQUE

Lignes principales :
- Ligne de vie (pli palmaire supérieur) : longueur, profondeur, clarté, interruptions, bifurcations
- Ligne de cœur (pli palmaire inférieur) : longueur, courbure, terminaison (monte vers Jupiter ? s'arrête sous Saturne ?), accidents (îles, chaînes, bifurcations)
- Ligne de tête (pli palmaire moyen) : droite ou incurvée vers le mont de la Lune ? liée ou séparée de la ligne de vie à l'origine ?
- Ligne de chance / Saturne : présence ou absence, clarté, origine et terminaison

Lignes secondaires si visibles :
- Ligne du Soleil : rayonnement, sens esthétique, tendance à la réussite
- Ceinture de Vénus : sensibilité émotionnelle intense, vie affective marquée
- Rascettes : mentionnées sobrement si visibles

Monts (reliefs palmaires) :
- Mont de Vénus (base du pouce) : amour, vitalité, sensualité
- Mont de Jupiter (base de l'index) : ambition, autorité, honneurs
- Mont de Saturne (base du médius) : sérieux, persévérance, profondeur, solitude
- Mont du Soleil (base de l'annulaire) : créativité, générosité, réussite
- Mont de Mercure (base de l'auriculaire) : intelligence, communication, intuition
- Mont de la Lune (bord opposé au pouce) : imagination, sensibilité, voyages intérieurs

Signes notables si visibles — mentionnés sobrement :
- Étoile : événement marquant, protection
- Île : période complexe sur la ligne concernée
- Carré : protection dans une période de crise
- Fourche en fin de ligne : dualité, richesse de tempérament
- Chaîne : sensibilité accrue, parfois fragilité

## CE QUE TU NE FAIS PAS

- Tu ne prédis jamais la mort, ni les maladies graves avec certitude
- Tu n'affirmes pas une destinée fixe ("vous allez rencontrer...")
- Tu ne mentionnes pas les astres, l'horoscope, les tarots — uniquement la chiromancie
- Tu ne génères pas de texte générique applicable à n'importe qui
- Tu ne fais pas de formulations comme "les étoiles vous disent", "le destin veut que"
- Tu ne dépasses pas 900 mots
- Tu ne mentionnes pas l'IA, l'automatisation, ni aucun outil technique

## FORMAT DE SORTIE

Texte Markdown. Titres avec ## pour chaque section. Commence directement par l'observation, sans introduction du système. Pas de conclusion du type "J'espère que..." — cela est ajouté séparément.`;
}

// ─── PROMPT UTILISATEUR ───────────────────────────────────────────────────────
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

// ─── GÉNÉRATION DU RAPPORT ────────────────────────────────────────────────────
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

// ─── FORMATAGE HTML ───────────────────────────────────────────────────────────
export function reportToHtml(report) {
  return report.split("\n").map((l) => {
    if (l.startsWith("## ")) return `<h2 class="rh2">${l.slice(3)}</h2>`;
    if (l.startsWith("---"))  return `<hr class="rhr">`;
    if (l.startsWith("*") && l.endsWith("*")) return `<p class="rit">${l.replace(/\*/g,"")}</p>`;
    if (!l.trim()) return "";
    return `<p class="rp">${l}</p>`;
  }).join("");
}

// ─── EMAILS ───────────────────────────────────────────────────────────────────
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

// ─── ENVOI EMAILS ─────────────────────────────────────────────────────────────
export async function sendEmails(resend, prenom, nom, email, dateNaissance, themeChoisi, report) {
  await Promise.all([
    resend.emails.send({ from: FROM_EMAIL, to: email,       subject: "Votre analyse de ligne de vie",        html: clientEmailHtml(prenom, report) }),
    resend.emails.send({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: `Nouvelle analyse — ${prenom} ${nom}`, html: adminEmailHtml(prenom, nom, email, dateNaissance, themeChoisi, report) }),
  ]);
}

// ─── NETTOYAGE IMAGES ─────────────────────────────────────────────────────────
export async function cleanupImages(supabase, leftPath, rightPath) {
  await Promise.allSettled([
    supabase.storage.from(BUCKET).remove([leftPath]),
    supabase.storage.from(BUCKET).remove([rightPath]),
  ]);
}
