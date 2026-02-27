export const runtime = "nodejs";

export default function MentionsLegalesPage() {
  const theme = {
    bg: "#FAF7F2",
    card: "#FFFFFF",
    border: "#E8E0D0",
    gold: "#C9A84C",
    text: "#3A3228",
    textLight: "#7A6F65",
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

  const h1 = { margin: 0, fontSize: 28, color: theme.text, letterSpacing: "0.01em" };
  const k = { fontSize: 11, color: theme.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 };
  const p = { fontSize: 14, lineHeight: 1.9, color: theme.textLight, margin: "10px 0" };
  const h2 = { fontSize: 16, color: theme.text, margin: "26px 0 8px" };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={k}>✦ Informations légales</div>
        <h1 style={h1}>Mentions légales</h1>
        <p style={p}>
          Les informations ci-dessous sont fournies afin de répondre aux obligations légales applicables aux services en ligne.
          Elles peuvent être complétées ou ajustées selon votre situation (entreprise, micro-entreprise, association).
        </p>

        <h2 style={h2}>Éditeur du site</h2>
        <p style={p}>
          Nom / Raison sociale : À compléter<br />
          Statut : À compléter<br />
          Adresse : À compléter<br />
          Email : À compléter<br />
          Numéro SIRET : À compléter
        </p>

        <h2 style={h2}>Directeur de la publication</h2>
        <p style={p}>À compléter</p>

        <h2 style={h2}>Hébergement</h2>
        <p style={p}>
          Le site est hébergé par Vercel Inc.<br />
          Adresse : 440 N Barranca Ave #4133, Covina, CA 91723, USA
        </p>

        <h2 style={h2}>Service proposé</h2>
        <p style={p}>
          Le site propose une lecture de mains (chiromancie) à partir de photographies transmises par l’utilisateur, afin de
          produire une lecture personnalisée orientée selon un thème choisi.
        </p>

        <h2 style={h2}>Responsabilité</h2>
        <p style={p}>
          L’éditeur s’efforce de fournir un service sérieux et soigné. L’utilisateur reste néanmoins responsable de l’usage qu’il
          fait des contenus délivrés. Le service repose sur une démarche d’interprétation (chiromancie) et ne constitue pas une
          expertise officielle.
        </p>

        <h2 style={h2}>Propriété intellectuelle</h2>
        <p style={p}>
          L’ensemble des contenus du site (textes, éléments visuels, mise en page, identité graphique) est protégé. Toute
          reproduction non autorisée est interdite.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>Pour toute question : À compléter</p>

        <p style={{ ...p, marginTop: 22 }}>
          Dernière mise à jour : À compléter
        </p>
      </div>
    </div>
  );
}
