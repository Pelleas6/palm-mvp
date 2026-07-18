import InformationPage from "../../components/InformationPage";
import { pageMetadata } from "../../lib/site-metadata.js";

export const metadata = pageMetadata({
  title: "Méthode de localisation de l’actualité",
  description: "La méthode de Le Pouls du Monde pour relier prudemment des articles publics à des pays et afficher leurs signaux sur une carte.",
  path: "/methode-localisation-actualite",
});

export default function MethodeLocalisationActualitePage() {
  return (
    <InformationPage
      eyebrow="Méthodologie"
      title="Localiser sans inventer."
      intro="Le Pouls du Monde privilégie une localisation explicite de l’événement à une couverture cartographique artificiellement complète."
    >
      <h2>La règle de localisation</h2>
      <p>Un pays est cartographié lorsqu’il est clairement cité dans le titre ou le résumé d’un article, ou lorsqu’un indice géographique équivalent permet de l’identifier sans ambiguïté. L’emplacement du média ne remplace jamais cette preuve.</p>

      <h2>En cas de doute</h2>
      <p>Un article dont l’événement n’est pas assez précisément localisable est conservé dans les articles reçus, avec l’état « À localiser ». Il ne rejoint pas la carte par défaut. Cette catégorie signale une limite de preuve, pas une absence d’intérêt.</p>

      <h2>Catégories et regroupements</h2>
      <p>Les couleurs servent à organiser les signaux par thèmes de lecture. Les regroupements visuels évitent le chevauchement quand plusieurs articles proches concernent le même espace et le même thème. Ils ne fusionnent pas des événements différents en une seule information.</p>

      <h2>Sources, cache et fraîcheur</h2>
      <p>Le tableau de santé indique l’état observé des flux publics. Les données sont relues côté serveur puis servies depuis un cache vérifié afin de limiter les requêtes répétées vers les éditeurs. La date de dernière lecture rend cette fraîcheur visible.</p>

      <h2>Limites assumées</h2>
      <p>Le système ne prétend pas représenter toute l’actualité mondiale. Les sources peuvent être incomplètes, certaines langues ou régions moins couvertes, et les flux temporairement indisponibles. Les liens vers les publications d’origine restent la référence pour comprendre chaque signal.</p>

      <p><a href="/sources-rss-internationales">Voir les principes de sélection des sources</a> · <a href="/#methodologie">Consulter les indicateurs dans l’observatoire</a></p>
    </InformationPage>
  );
}
