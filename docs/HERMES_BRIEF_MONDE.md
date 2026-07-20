# Publication d’un brief mondial par Hermes

## Production : historique persistant + publication versionnée par GitHub

Le premier format ne dépend pas encore d’une base éditoriale. Hermes publie en modifiant `content/briefs.json`, puis en poussant le commit sur `main`. Vercel reconstruit alors les pages publiques.

Le contenu public reste versionné dans Git (`content/briefs.json`) afin que chaque édition soit relisible et réversible. Les signaux RSS et leur état de source sont désormais archivés séparément dans Supabase : cela donne à Hermes une période réelle à analyser, au lieu d’un instantané de cache.

Le protocole récurrent et les preuves exigées sont dans `docs/HERMES_AUTOMATION_BRIEF_MONDE.md`.

## Règles non négociables

- un brief est un **brouillon** tant que `status` n’est pas défini à `published` ;
- ne jamais présenter le volume d’articles comme une mesure de gravité ;
- ne jamais laisser les articles `non déterminés` ou `à qualifier` définir le thème principal ;
- chaque fait externe important doit être relié à une source dans `sources` ;
- ne pas reproduire de longs extraits ni d’images de presse sans droit d’usage ;
- le contenu doit être écrit en français, sobrement, avec des incertitudes explicites ;
- un seul brief publié par période ; conserver les anciens briefs dans le fichier.

## Contrat de contenu

Ajouter un objet JSON valide dans le tableau `content/briefs.json` :

```json
{
  "slug": "semaine-du-20-au-26-juillet-2026",
  "status": "draft",
  "pilot": false,
  "eyebrow": "Brief mondial",
  "periodLabel": "Semaine du 20 au 26 juillet 2026",
  "publishedAt": "2026-07-26T18:00:00.000Z",
  "readingTime": "5 min de lecture",
  "title": "Un titre factuel et sans sensationnalisme.",
  "standfirst": "Deux ou trois phrases qui résument l’angle et les limites.",
  "lead": "La synthèse chiffrée, avec la période et le périmètre de données.",
  "metrics": [
    { "value": "…", "label": "articles retenus", "detail": "Période et périmètre" },
    { "value": "…", "label": "signaux localisés", "detail": "Méthode prudente" },
    { "value": "…", "label": "médias actifs", "detail": "Diversité des sources" }
  ],
  "sections": [
    { "title": "Ce que l’on peut observer", "paragraphs": ["…", "…"] }
  ],
  "sources": [
    { "label": "Nom de la source", "url": "https://…", "note": "Pourquoi elle est utilisée" }
  ],
  "methodNote": "Limite de lecture précise et honnête."
}
```

## Publication

1. Vérifier que le JSON est valide.
2. Mettre `status` à `published` uniquement après validation éditoriale.
3. Committer et pousser sur `main` avec un message explicite, par exemple `content: publish weekly world brief 2026-07-26`.
4. Vérifier après le déploiement Vercel : `/brief-mondial` puis l’URL générée par `slug`.
5. Enregistrer la preuve de publication dans `POST /api/brief-history/brief-audit` avec le SHA Git, l’URL Vercel finale et la période utilisée.

Un `status: "published"` sans réponse HTTP 200 de l’URL finale n’est jamais une publication valide.
