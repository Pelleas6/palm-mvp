import InformationPage from "../../components/InformationPage";
import { pageMetadata } from "../../lib/site-metadata.js";

export const metadata = pageMetadata({
  title: "À propos — Le Pouls du Monde",
  description: "La méthode de lecture et les principes de transparence de Le Pouls du Monde.",
  path: "/a-propos",
});

export default function AProposPage() {
  return (
    <InformationPage
      eyebrow="À propos"
      title="Rendre le monde plus lisible."
      intro="Le Pouls du Monde rassemble des signaux médiatiques publics pour les rendre plus intuitifs à explorer, sans prétendre résumer toute l'actualité."
    >
      <h2>Une carte, mais pas une simplification</h2>
      <p>La carte n'affiche pas l'origine supposée d'un média. Elle situe l'événement lorsqu'un pays ou une capitale est clairement cité dans le titre ou le résumé de l'article. En cas de doute, l'article reste visible dans le flux mais n'est pas placé sur la carte.</p>

      <h2>Ce que racontent les couleurs</h2>
      <p>Les couleurs correspondent à des thèmes de lecture. Elles aident à repérer les concentrations de sujets, sans constituer un jugement sur leur importance ou leur gravité.</p>

      <h2>Des sources visibles</h2>
      <p>Les articles conservent leur lien vers la source d'origine. Les indicateurs de santé permettent aussi de voir quelles sources ont répondu, lesquelles sont dégradées et la fraîcheur de la dernière lecture.</p>

      <h2>Un outil d'exploration</h2>
      <p>Le site est conçu pour faire émerger des questions et donner envie de consulter les sources, pas pour produire une vérité définitive. La section de transparence de l'accueil permet de vérifier comment les données ont été construites.</p>

      <h2>Pour aller plus loin</h2>
      <ul>
        <li><a href="/carte-actualite-mondiale">Comprendre la carte de l’actualité mondiale</a></li>
        <li><a href="/methode-localisation-actualite">Lire la méthode de localisation</a></li>
        <li><a href="/sources-rss-internationales">Consulter les principes de sélection des sources</a></li>
      </ul>
    </InformationPage>
  );
}
