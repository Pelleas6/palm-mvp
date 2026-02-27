export const runtime = "nodejs";

export default function ConfidentialitePage() {
  const theme = {
    bg: "#FAF7F2",
    card: "#FFFFFF",
    border: "#E8E0D0",
    gold: "#C9A84C",
    text: "#3A3228",
    textLight: "#7A6F65",
    sage: "#7A9E7E",
    sageLight: "#EFF5F0",
    sageBorder: "#B5CDB7",
  };

  const wrap = {
    backgroundColor: theme.bg,
    minHeight: "100vh",
    padding: "56px 22px",
    fontFamily: "Georgia, serif",
  };

  const card = {
    maxWidth: 860,
    margin: "0 auto",
    backgroundColor: theme.card,
    borderRadius: 18,
    border: `1px solid ${theme.border}`,
    padding: "34px 28px",
    boxShadow: "0 10px 42px rgba(0,0,0,0.06)",
  };

  const k = { fontSize: 11, color: theme.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 };
  const h1 = { margin: 0, fontSize: 28, color: theme.text, letterSpacing: "0.01em" };
  const p = { fontSize: 14, lineHeight: 1.9, color: theme.textLight, margin: "10px 0" };
  const h2 = { fontSize: 16, color: theme.text, margin: "26px 0 8px" };

  const badge = {
    display: "inline-block",
    fontSize: 12,
    color: theme.sage,
    border: `1px solid ${theme.sageBorder}`,
    backgroundColor: theme.sageLight,
    borderRadius: 999,
    padding: "6px 12px",
    marginTop: 14,
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={k}>✦ Données & confidentialité</div>
        <h1 style={h1}>Politique de confidentialité</h1>
        <p style={p}>
          Cette page explique comment les informations transmises via le formulaire sont utilisées, stockées et protégées.
        </p>
        <div style={badge}>Photos supprimées après analyse</div>

        <h2 style={h2}>Données collectées</h2>
        <p style={p}>
          Lors d’une demande d’analyse, nous pouvons collecter :
          <br />• Prénom et nom
          <br />• Adresse email
          <br />• Date de naissance
          <br />• Thème de lecture choisi
          <br />• Deux photographies (main gauche / main droite)
        </p>

        <h2 style={h2}>Finalité</h2>
        <p style={p}>
          Ces données sont utilisées uniquement pour :
          <br />• traiter la demande de lecture de mains,
          <br />• produire et transmettre le rapport par email,
          <br />• assurer le bon fonctionnement et la sécurité du service.
        </p>

        <h2 style={h2}>Stockage et suppression des photos</h2>
        <p style={p}>
          Les photographies sont stockées de manière temporaire le temps du traitement. Elles sont ensuite supprimées après analyse.
        </p>

        <h2 style={h2}>Durée de conservation</h2>
        <p style={p}>
          Les informations nécessaires au suivi de la demande (ex : email, date de demande, thème choisi) peuvent être conservées
          pendant une durée limitée à des fins de support et de traçabilité, puis supprimées.
          <br />
          Durées exactes : à compléter selon ta politique finale.
        </p>

        <h2 style={h2}>Sous-traitants techniques</h2>
        <p style={p}>
          Le service peut s’appuyer sur des prestataires techniques pour fonctionner (hébergement, stockage, traitement). Exemple :
          hébergement via Vercel et stockage via Supabase. Ces prestataires n’accèdent aux données que dans la mesure nécessaire à
          l’exécution du service.
        </p>

        <h2 style={h2}>Sécurité</h2>
        <p style={p}>
          Nous mettons en œuvre des mesures de sécurité adaptées (contrôles d’accès, limitation des requêtes, journaux techniques)
          afin de protéger les données transmises.
        </p>

        <h2 style={h2}>Vos droits</h2>
        <p style={p}>
          Vous pouvez demander l’accès, la rectification ou la suppression de vos données en nous contactant :
          <br />
          Contact : à compléter
        </p>

        <p style={{ ...p, marginTop: 22 }}>
          Dernière mise à jour : À compléter
        </p>
      </div>
    </div>
  );
}
