# HANDOFF PALM-MVP — Rapport Final de Clôture

## 1. État du site
- URL : https://palm-mvp-snowy.vercel.app
- Statut : Déployé (Production)
- Build : OK (Next.js 14.2.3)

## 2. Dernier commit déployé
- Hash : `2f4516e`
- Description : "security: add OTP session flow and protect palm upload checkout"

## 3. Accès Hermes confirmés
- Accès local (FS) : OK
- Accès Git (SSH) : OK
- Accès Terminal : OK

## 4. Accès non confirmés ou manuels
- Supabase Dashboard : Manuel (via navigateur)
- Stripe Dashboard : Manuel (via navigateur)
- Vercel Dashboard : Manuel (via navigateur)

## 5. Variables Vercel attendues
- SITE_URL, STRIPE_PRICE_ID
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

## 6. Supabase
- Bucket : `palm-uploads` (Privé)
- Accès : Signed URLs uniquement côté backend.

## 7. Stripe
- Mode : À confirmer dans le dashboard (vérifier si les clés utilisées sont `sk_test_` ou `sk_live_`).
- Price_ID : Doit correspondre à la configuration Vercel.

## 8. Procédure pour modifier le site
1. Pull la dernière version.
2. Créer une branche de feature.
3. Tester localement (`npm run build`).
4. Commit et Push.
5. Vérifier le déploiement sur le dashboard Vercel.

## 9. Procédure pour corriger une erreur
1. Consulter les logs Vercel (Runtime logs).
2. Analyser avec `systematic-debugging` (si besoin, demander à l'agent).
3. Patcher et tester localement avant de proposer le commit.

## 10. Ce qu’il ne faut JAMAIS faire sans autorisation
- Pousser des secrets (`.env`) sur le dépôt.
- Modifier les policies Supabase en public.
- Déclencher des paiements réels en production sans test préalable.
- Modifier la configuration Hermes (SOUL, Skills) sans validation utilisateur.
