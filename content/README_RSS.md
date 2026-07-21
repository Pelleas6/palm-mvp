# Catalogue RSS France

Le fichier `rss-feeds-france.json` est la seule liste à modifier pour ajouter, retirer ou corriger les flux français proposés par Karim.

## Une ligne = un flux

Chaque objet contient :

- `enabled` : `true` pour lire le flux au prochain déploiement ; `false` pour le conserver sans le solliciter ;
- `theme` : famille éditoriale, uniquement pour organiser le catalogue ;
- `media` et `feed` : le nom visible dans les filtres et le contrôle de santé ;
- `url` : adresse RSS exacte ;
- `sourceCountry`, `region`, `language` : provenance du média, jamais le pays de l'événement ;
- `maxItems` : plafond conseillé, généralement entre 5 et 8, pour ne pas faire dominer un média.

## Règle de mise en service

Le catalogue conserve tous les flux fournis, mais seulement une sélection générale est active par défaut. Avant d'activer plusieurs flux d'une même rédaction, vérifier le build et la santé des sources : trop de flux simultanés ralentissent la collecte et créent des doublons.

Pour Hermes : modifier uniquement ce JSON pour la sélection française, garder au moins un flux général par média, puis exécuter `npm test` et `npm run build`. Ne jamais mettre une clé ou un secret dans ce fichier.
