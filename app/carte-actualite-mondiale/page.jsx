import InformationPage from "../../components/InformationPage";
import { pageMetadata } from "../../lib/site-metadata.js";

export const metadata = pageMetadata({
  title: "Carte de l’actualité mondiale",
  description: "Comprendre la carte de l’actualité mondiale de Le Pouls du Monde : sources publiques, signaux localisés et limites de lecture.",
  path: "/carte-actualite-mondiale",
});

export default function CarteActualiteMondialePage() {
  return (
    <InformationPage
      eyebrow="Guide de lecture"
      title="Lire l’actualité mondiale sur une carte."
      intro="La carte rassemble des signaux médiatiques publics pour rendre leurs répartitions géographiques plus faciles à explorer, sans les confondre avec une mesure de l’importance réelle des événements."
    >
      <h2>Ce que montre la carte</h2>
      <p>Chaque point correspond à un article dont le titre ou le résumé apporte un indice géographique suffisamment clair. Lorsqu’ils sont proches et relèvent d’un même thème, plusieurs signaux se regroupent dans une bulle. La couleur indique le thème de lecture ; le volume indique le nombre d’articles regroupés.</p>

      <h2>Ce que la carte ne mesure pas</h2>
      <p>Un grand nombre de signaux ne prouve ni la gravité d’une situation, ni son importance politique, ni l’exhaustivité de la couverture médiatique. Les flux disponibles, les langues, les horaires de publication et les limites de localisation influencent tous la lecture.</p>

      <h2>Pourquoi certains articles restent hors carte</h2>
      <p>Un article sans pays d’événement explicitement établi reste visible dans le flux, mais n’est pas placé artificiellement sur le pays du média. Cette prudence évite de transformer une origine éditoriale en localisation d’événement.</p>

      <h2>Utiliser la carte avec méthode</h2>
      <p>La carte sert à repérer une concentration, puis à ouvrir les sources qui l’expliquent. Elle est plus utile comme point de départ d’une vérification que comme conclusion autonome.</p>

      <p><a href="/#carte">Ouvrir la carte vivante</a> · <a href="/methode-localisation-actualite">Lire la méthode de localisation</a></p>
    </InformationPage>
  );
}
