# Publication d’un brief mondial par Hermes

## Première version : publication versionnée par GitHub

Le premier format ne dépend pas encore d’une base éditoriale. Hermes publie en modifiant `content/briefs.json`, puis en poussant le commit sur `main`. Vercel reconstruit alors les pages publiques.

Cette méthode est volontairement simple pour tester le rendu et le niveau éditorial avant d’automatiser l’historique des signaux.

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

Les données brutes et les comparaisons historiques seront ajoutées dans une seconde étape, après validation de ce format.
