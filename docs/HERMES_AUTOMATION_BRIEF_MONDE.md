# Automatisation Hermes — brief mondial

Ce document est le contrat d’exécution. Il transforme la publication en chaîne vérifiable : **collecte → historique → analyse → publication → preuve**. Aucun message de fin ne doit être envoyé sans les preuves demandées à la fin de ce document.

## Préparation unique

1. Dans Supabase, exécuter une seule fois `supabase/migrations/20260720_world_pulse_history.sql`.
2. Dans Vercel **et** dans le coffre de secrets Hermes, définir les trois variables privées suivantes : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORLD_PULSE_INGEST_SECRET`.
3. Ne jamais écrire ces valeurs dans Git, dans un ticket Kanban, dans un log ou dans une réponse.
4. Vérifier que `GET https://ma-ligne-de-vie.fr/api/brief-history/health` répond `state: "ready"`. Tant que ce n’est pas le cas, la tâche est `BLOCKED`, jamais `DONE`.

## Colonnes Kanban à créer

- **Configuration** — migration Supabase, variables privées et test de santé.
- **Collecte historique** — chaque exécution conserve un instantané RSS dédupliqué, les pays, catégories et santé des sources.
- **Édition hebdomadaire** — analyse de la période et rédaction.
- **Vérification de publication** — build, Git, Vercel, URL réelle et audit.
- **Bloqué** — données insuffisantes, source indisponible ou preuve manquante.

Les tâches récurrentes doivent rester dans ce tableau ; ne pas créer de cron système local ni de simulation de planning.

## Cron Hermes 1 — collecte, quatre fois par jour

Planifier à **00:15, 06:15, 12:15 et 18:15 Europe/Paris** (ou la règle Cron équivalente dans l’outil Hermes). Le rythme est volontairement modéré : il préserve les sources RSS et donne une base hebdomadaire suffisante.

Exécuter :

```bash
curl --fail-with-body --silent --show-error \
  -X POST https://ma-ligne-de-vie.fr/api/brief-history/ingest \
  -H "Authorization: Bearer $WORLD_PULSE_INGEST_SECRET"
```

Critères de succès : réponse `201`, `state: "stored"`, nombre d’articles et date `collectedAt`. En cas de `401`, `503`, `not_stored` ou de données RSS non enregistrables : déplacer la tâche dans **Bloqué**, conserver la réponse non sensible et réessayer au cycle suivant. Ne pas boucler en rafale.

## Cron Hermes 2 — édition hebdomadaire

Planifier chaque **lundi à 08:15 Europe/Paris**. La période lue est du lundi 00:00 au lundi suivant 00:00, soit les sept jours précédents.

1. Lire l’historique avec l’en-tête d’autorisation :

```bash
curl --fail-with-body --silent --show-error \
  "https://ma-ligne-de-vie.fr/api/brief-history?from=<ISO_DEBUT>&to=<ISO_FIN>&articles=160" \
  -H "Authorization: Bearer $WORLD_PULSE_INGEST_SECRET"
```

2. Ne publier que si les garde-fous sont atteints : au moins **18 instantanés**, **250 articles uniques**, **18 sources actives** et **55 % de localisation**. Les catégories `Non déterminé` et `À qualifier` restent visibles comme limite, mais ne peuvent jamais devenir le thème dominant.
3. Si un garde-fou échoue : créer ou conserver un brief `draft` avec une note explicite, déplacer la tâche dans **Bloqué** et ne pas promettre un article « en ligne ».
4. Si les garde-fous passent : utiliser les agrégats et les URL d’articles fournis comme socle. Compléter au besoin avec des sources primaires ou éditoriales fiables. Chaque information externe importante doit avoir une URL dans `sources`.
5. Rédiger un article français professionnel, factuel, de 700 à 1 100 mots : titre sobre, angle clair, 3 à 4 sections, chiffres avec période, limites nettes. Le volume médiatique n’est jamais une mesure de gravité. Ne pas créer ou réutiliser une image de presse sans droit ; la carte et les liens sources suffisent.
6. Ajouter l’objet au format de `content/briefs.json` avec un slug unique, `pilot: false` et `status: "published"` seulement après les contrôles suivants.
7. Lancer `npm test` puis `npm run build`. Si l’un échoue, revenir à `draft` et placer la tâche dans **Bloqué**.
8. Committer sur `main` avec `content: publish weekly world brief YYYY-MM-DD`. Attendre le déploiement Vercel de **ce SHA exact**.
9. Vérifier par HTTP que `/brief-mondial` et `/brief-mondial/<slug>` répondent 200 et que le titre publié est présent. Enregistrer ensuite l’audit :

```bash
curl --fail-with-body --silent --show-error \
  -X POST https://ma-ligne-de-vie.fr/api/brief-history/brief-audit \
  -H "Authorization: Bearer $WORLD_PULSE_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"slug":"<slug>","status":"published","gitSha":"<sha>","deploymentUrl":"https://ma-ligne-de-vie.fr/brief-mondial/<slug>","periodStart":"<ISO_DEBUT>","periodEnd":"<ISO_FIN>","articleCount":<nombre>,"localizationRate":<pourcentage>,"publishedAt":"<ISO>"}'
```

## Format obligatoire du rapport Hermes

Une tâche n’est `DONE` qu’avec les cinq éléments réels suivants :

1. la période et les quatre indicateurs lus dans l’historique ;
2. le SHA Git complet et la liste exacte des fichiers modifiés ;
3. le résultat de `npm test` et de `npm run build` ;
4. l’identifiant/l’URL du déploiement Vercel correspondant à ce SHA ;
5. l’URL publique finale testée avec son statut HTTP 200, puis la réponse `audited`.

Interdictions : ne pas recycler un SHA ancien, ne pas annoncer une URL non testée, ne pas transformer un `draft` en publication dans le rapport, ne pas masquer une insuffisance de localisation ou une source en erreur.
