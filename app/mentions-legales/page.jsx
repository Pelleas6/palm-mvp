import InformationPage from "../../components/InformationPage";

export const metadata = {
  title: "Mentions légales — Le Pouls du Monde",
  description: "Informations légales et conditions de lecture de l'observatoire Le Pouls du Monde.",
};

export default function MentionsLegalesPage() {
  return (
    <InformationPage
      eyebrow="Informations légales"
      title="Le cadre de l'observatoire."
      intro="Le Pouls du Monde propose une lecture expérimentale et sourcée de signaux médiatiques publics. Ce n'est ni une alerte officielle, ni un média, ni une recommandation."
    >
      <h2>Service proposé</h2>
      <p>Le site visualise des articles publics, des regroupements thématiques et des signaux géographiques. Une localisation n'est affichée que lorsqu'elle est explicitement justifiée par le titre ou le résumé d'un article.</p>

      <h2>Limites de lecture</h2>
      <p>Les données proviennent de services tiers. Elles peuvent contenir des retards, des imprécisions ou des interruptions. Elles ne remplacent pas les informations des autorités compétentes, des médias d'origine ou des professionnels concernés.</p>

      <h2>Hébergement</h2>
      <p>Le site est hébergé sur l'infrastructure Vercel.</p>

      <h2>Propriété intellectuelle</h2>
      <p>Les textes, l'identité visuelle, le code et la mise en page du site ne peuvent être reproduits sans autorisation. Les articles consultés restent la propriété de leurs éditeurs respectifs.</p>

      <h2>Éditeur et contact</h2>
      <p>L'identité complète de l'éditeur, son statut, son adresse de contact et, le cas échéant, ses informations d'immatriculation doivent être publiés ici avant toute exploitation commerciale ou communication publique du site.</p>
      <p className="note">Information à finaliser : je n'ai pas inventé ces données. Dès que tu me donnes le nom d'éditeur et l'adresse de contact à afficher, je les ajoute proprement dans la même version.</p>

      <p className="mini-label">Dernière mise à jour · 18 juillet 2026</p>
    </InformationPage>
  );
}
