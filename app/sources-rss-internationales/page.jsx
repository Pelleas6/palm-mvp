import InformationPage from "../../components/InformationPage";
import { pageMetadata } from "../../lib/site-metadata.js";

export const metadata = pageMetadata({
  title: "Sources RSS internationales : sélection et limites",
  description: "Comment Le Pouls du Monde sélectionne, contrôle et présente des sources RSS internationales publiques.",
  path: "/sources-rss-internationales",
});

export default function SourcesRssInternationalesPage() {
  return (
    <InformationPage
      eyebrow="Transparence des sources"
      title="Des sources visibles, pas une boîte noire."
      intro="L’observatoire s’appuie sur des flux publics et conserve le lien vers leur publication d’origine pour que chaque lecture puisse être vérifiée."
    >
      <h2>Quels flux sont utilisés ?</h2>
      <p>Le Pouls du Monde lit des flux RSS publics de médias internationaux et des jeux de données documentaires. Les sources sont présentées avec leur région, leur URL, leur état technique et le nombre d’articles ou documents reçus lors du dernier contrôle.</p>

      <h2>Comment une source est évaluée</h2>
      <p>Un contrôle côté serveur vérifie si le flux répond, si son format est exploitable et si des contenus récents sont disponibles. Un délai d’attente, une réponse HTTP dégradée ou un flux invalide est affiché comme tel : aucune source de remplacement n’est inventée.</p>

      <h2>Pourquoi une source peut manquer</h2>
      <p>Un flux peut être temporairement indisponible, limiter les accès automatisés, changer de format ou ne plus publier. Ces situations réduisent momentanément la couverture ; elles ne doivent pas être interprétées comme l’absence d’actualité dans la région concernée.</p>

      <h2>Lire au-delà de l’agrégation</h2>
      <p>Les titres et liens servent à orienter la lecture. Pour le contexte, la nuance et la vérification, il faut consulter le média d’origine. L’observatoire ne remplace ni l’enquête journalistique ni les informations officielles.</p>

      <p><a href="/sante-sources">Consulter la santé des sources</a> · <a href="/methode-localisation-actualite">Lire la méthode de localisation</a></p>
    </InformationPage>
  );
}
