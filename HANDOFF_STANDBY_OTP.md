# HANDOFF — État Stand-by palm-mvp (OTP Blocage)

## 1. Dernier état stable
- Commit actif : `7b87076` (fix: repair OpenAI vision report generation)
- Statut Vercel : Ready / Production.

## 2. État du correctif OpenAI
- Correction Vision (`chat.completions.create`) déployée avec succès.

## 3. Problème restant
- Blocage au clic sur le bouton "Vérifier" (email) : erreur frontend "fetch failed".
- Route API suspecte : `/api/send-otp`.

## 4. Variables Vercel à vérifier
- `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SITE_URL`.
- Observations : Certaines variables sensibles ("Needs Attention" dans Vercel).

## 5. Hypothèses
- Erreur de configuration (Variables non transmises à l'environnement Production ou clés invalides).
- Échec d'initialisation de Resend ou Redis (crash runtime).
- Erreur de portée (CORS ou URL incorrecte).

## 6. Stop conditions
- Aucune modification de code ou configuration ne doit être effectuée sans autorisation.

## 7. Prompt de reprise
"REPRISE PALM-MVP — OTP FETCH FAILED. Contexte : Dernier commit actif 7b87076. Correction OpenAI vision déjà déployée. Blocage actuel : bouton “Vérifier” email affiche fetch failed. Route suspecte : /api/send-otp. Objectif : Identifier l’erreur exacte au clic sur “Vérifier”, sans rien modifier. Autorisation : Lecture seule. Étapes : Lire les fichiers OTP, surveiller Runtime Logs Vercel, rapporter l'erreur sans secret."
