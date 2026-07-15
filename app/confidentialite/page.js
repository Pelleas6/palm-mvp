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
    fontFamily: "Georgia, serif",
  };

  const topbar = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backgroundColor: "rgba(250,247,242,0.95)",
    backdropFilter: "blur(8px)",
    borderBottom: `1px solid ${theme.border}`,
  };

  const topbarInner = {
    maxWidth: 900,
    margin: "0 auto",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  };

  const brandTitle = {
    fontWeight: 700,
    fontSize: 18,
    color: theme.text,
    letterSpacing: "0.02em",
  };

  const backBtn = {
    textDecoration: "none",
    color: theme.sage,
    fontSize: 13,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.card,
    padding: "8px 12px",
    borderRadius: 10,
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

  const contentPad = {
    padding: "34px 22px 56px",
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

  const bottomBack = {
    marginTop: 22,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: theme.sage,
    textDecoration: "none",
    fontSize: 13,
  };

  return (
    <div style={wrap}>
      {/* Top bar + retour accueil */}
      <div style={topbar}>
        <div style={topbarInner}>
          <a href="/" style={brand}>
            <span style={{ fontSize: 22 }}>◉</span>
            <span style={brandTitle}>Le Pouls du Monde</span>
          </a>

          <a href="/" style={backBtn}>
            ← Retour à l’accueil
          </a>
        </div>
      </div>

      <div style={contentPad}>
        <div style={card}>
          <div style={k}>GDELT · Données & confidentialité</div>
          <h1 style={h1}>Politique de confidentialité</h1>
          <p style={p}>
            Cette page décrit le fonctionnement des données pour le tableau de bord « Le Pouls du Monde ».
          </p>
          <div style={badge}>Aucune donnée nominative demandée par le tableau de bord</div>

          <h2 style={h2}>Données collectées</h2>
          <p style={p}>
            Le tableau de bord ne demande ni compte utilisateur, ni formulaire nominatif, ni fichier personnel.
            La consultation peut générer des journaux techniques standards liés à l’hébergement et à la sécurité
            (adresse IP, agent navigateur, horodatage, URL appelée).
          </p>

          <h2 style={h2}>Finalité</h2>
          <p style={p}>
            Les informations techniques éventuelles servent uniquement à afficher le tableau de bord, appeler l’endpoint
            local GDELT, diagnostiquer les erreurs et protéger le service contre les abus.
          </p>

          <h2 style={h2}>Stockage applicatif</h2>
          <p style={p}>
            Le tableau de bord affiche des données publiques issues de GDELT et ne stocke pas de dossier utilisateur dans
            l’application. Les journaux techniques de l’hébergeur suivent les durées et règles propres à l’infrastructure utilisée.
          </p>

          <h2 style={h2}>Durée de conservation</h2>
          <p style={p}>
            Les éventuels journaux techniques sont conservés pour une durée limitée aux besoins de sécurité, de diagnostic
            et de supervision du service.
          </p>

          <h2 style={h2}>Sous-traitants techniques</h2>
          <p style={p}>
            Le service peut s’appuyer sur des prestataires techniques pour l’hébergement et la récupération de données publiques,
            notamment Vercel pour l’exécution web et GDELT pour les articles indexés. Ces prestataires interviennent uniquement
            dans le cadre technique nécessaire au fonctionnement du tableau de bord.
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

          <p style={{ ...p, marginTop: 22 }}>Dernière mise à jour : À compléter</p>

          <a href="/" style={bottomBack}>
            ← Retour à la page principale
          </a>
        </div>
      </div>
    </div>
  );
}
