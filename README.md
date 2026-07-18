# Le Pouls du Monde

Un observatoire visuel de signaux médiatiques mondiaux : une carte interactive, des articles publics, des tendances contextualisées et une méthode de localisation volontairement prudente.

## Principes

- les articles proviennent de flux RSS publics ;
- un signal n'est placé sur la carte que lorsqu'un pays ou une capitale est explicitement mentionné dans le titre ou le résumé ;
- la provenance d'un média reste distincte du pays de l'événement ;
- les données absentes, anciennes ou non localisables restent visibles comme telles, sans remplissage artificiel.

## Développement

```bash
npm ci
npm run dev
```

Vérifications avant publication :

```bash
npm test
npm run build
```

## Compteur discret d'explorations

Le footer affiche un total cumulé d'explorations. Une exploration est ajoutée une seule fois par session de navigateur ; le compteur n'est pas un compteur de visiteurs uniques ni un outil de profilage.

Par défaut, l'application utilise le compteur public CounterAPI V1, sans configuration à ajouter. Le compteur disparaît simplement si le fournisseur est indisponible ; le reste du site n'est jamais bloqué.

Pour passer au mode privé et authentifié CounterAPI V2, renseigner ces variables dans l'environnement de déploiement :

```text
COUNTER_API_WORKSPACE=...
COUNTER_API_KEY=...
COUNTER_API_COUNTER=explorations
```

Optionnellement, le nom de l'espace public V1 peut être remplacé avec `COUNTER_API_NAMESPACE`.

## Fiabilité et protection

- la page relit son instantané toutes les 30 secondes, mais les flux externes restent mis en cache côté serveur pendant au moins 15 minutes ;
- si une nouvelle lecture échoue, le dernier instantané valide peut être servi pendant 24 heures (`stale-if-error`) au lieu de vider la carte ;
- les flux sont lus avec une concurrence limitée, un délai RSS de 5,5 secondes et une taille de réponse maximale de 1,5 Mo ;
- les routes publiques appliquent un lissage anti-rafale par instance et retournent une réponse `429` avec délai de reprise plutôt que de surcharger les sources ;
- les en-têtes de sécurité désactivent l'encadrement par des tiers, les types MIME ambigus et les permissions navigateur inutiles.

Le lissage applicatif complète la protection d'infrastructure. Pour une exposition importante, activer aussi les protections anti-DDoS / WAF du fournisseur d'hébergement au niveau du domaine.

## Pages publiques

- `/` — carte et exploration des signaux
- `/a-propos` — méthode et limites de lecture
- `/sante-sources` — état mémoire des sources
- `/confidentialite` — données et fonctionnement technique
- `/mentions-legales` — cadre du service

Avant une exploitation commerciale ou une communication publique, compléter l'identité et le contact de l'éditeur dans les mentions légales : ces informations ne sont pas inventées par le code.
