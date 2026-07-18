import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "../lib/site-metadata.js";

// Ces règles arrivent dans le premier octet HTML, avant les styles détaillés
// du tableau de bord client : l'utilisateur ne voit donc jamais une page
// blanche ou une structure HTML brute pendant le chargement des bundles.
const criticalShellCss = `
  :root{color-scheme:dark;background:#051117}
  html{min-height:100%;background:#051117}
  body{min-height:100%;margin:0;background:#051117;color:#effafa;font-family:"Segoe UI Variable","Aptos",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .site-header{min-height:62px;border-bottom:1px solid rgba(173,213,213,.14);background:#051117}
  .pulse-shell{width:min(1320px,calc(100% - 32px));min-height:72vh;margin:0 auto;padding:28px 0 40px}
  .pulse-shell .top-strip,.pulse-shell .metric-grid,.pulse-shell .map-experience{display:grid;gap:12px;margin-bottom:18px}
  .pulse-shell .title-block,.pulse-shell .status-panel,.pulse-shell .panel,.pulse-shell .metric-card{border:1px solid rgba(173,213,213,.17);background:#0b1f27}
  .pulse-shell .title-block{min-height:238px;padding:clamp(24px,3.4vw,40px)}
  .pulse-shell h1{margin:0;font-size:clamp(2.85rem,5.7vw,5.8rem);line-height:.94;letter-spacing:-.06em}
  .pulse-shell h2{margin:0}.pulse-shell .map-panel-wide{padding:18px}.pulse-shell .signal-field{padding:8px;overflow:hidden;background:#07110f}.pulse-shell .map-viewport{position:relative;width:100%;aspect-ratio:2/1;overflow:hidden}
  .route-loading{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 42%,rgba(95,218,201,.15),transparent 18rem),#051117;color:#effafa}.route-loading section{width:min(360px,100%);display:grid;gap:12px;text-align:center}.route-loading p{margin:0;color:#5fdac9;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.route-loading strong{font-size:1.08rem}.route-loading span{color:#9ebbbb;font-size:.8rem}.route-loading-line{height:2px;overflow:hidden;border-radius:999px;background:rgba(173,213,213,.16)}
  @media(max-width:680px){.pulse-shell{width:min(1320px,calc(100% - 20px));padding-top:10px}.pulse-shell .title-block{min-height:0;padding:24px}.pulse-shell h1{font-size:clamp(3.2rem,18vw,5rem)}}
`;

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Le Pouls du Monde | Carte de l’actualité mondiale",
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Le Pouls du Monde | Carte de l’actualité mondiale",
    description: SITE_DESCRIPTION,
    url: "/",
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: "Le Pouls du Monde | Carte de l’actualité mondiale",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: SITE_NAME,
      inLanguage: "fr-FR",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: SITE_NAME,
      url: SITE_ORIGIN,
      description: "Observatoire visuel des signaux médiatiques mondiaux.",
    },
  ],
};

export const viewport = {
  themeColor: "#051117",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalShellCss }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
