import InformationPage from "../../components/InformationPage";

export const metadata = {
  title: "Confidentialité — Le Pouls du Monde",
  description: "Comment Le Pouls du Monde traite les données nécessaires à son fonctionnement.",
};

export default function ConfidentialitePage() {
  return (
    <InformationPage
      eyebrow="Données & confidentialité"
      title="Une lecture du monde, pas de votre vie privée."
      intro="Le Pouls du Monde affiche des données publiques d'actualité. Il ne demande ni compte, ni nom, ni photo, ni document personnel."
    >
      <h2>Ce que le site affiche</h2>
      <p>La carte et les listes s'appuient sur des flux RSS publics et des jeux de données GDELT. Ces sources peuvent être incomplètes, retardées ou temporairement indisponibles.</p>

      <h2>Ce que le site ne demande pas</h2>
      <p>Aucun compte utilisateur, formulaire nominatif, fichier personnel ou donnée bancaire n'est requis pour consulter l'observatoire.</p>

      <h2>Fonctionnement technique</h2>
      <p>L'hébergement peut générer des journaux techniques standards nécessaires à la sécurité et au diagnostic. Les règles de conservation associées relèvent de l'hébergeur.</p>
      <p>Un compteur discret affiche le nombre cumulé d'explorations du site. Il compte une exploration par session de navigateur, sans créer de profil personnel ni demander d'identité au visiteur.</p>

      <h2>Prestataires techniques</h2>
      <p>Le fonctionnement peut mobiliser Vercel pour l'hébergement, GDELT et les éditeurs de flux RSS publics pour les données, ainsi qu'un service de compteur technique pour l'affichage du total d'explorations.</p>

      <h2>Vos droits et contact</h2>
      <p>Pour toute demande relative aux données techniques pouvant vous concerner, utilisez le contact de l'éditeur indiqué dans les mentions légales.</p>

      <p className="mini-label">Dernière mise à jour · 18 juillet 2026</p>
    </InformationPage>
  );
}
