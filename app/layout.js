import "./globals.css";

export const metadata = {
  title: "Le Pouls du Monde — l'actualité mondiale en mouvement",
  description: "Un observatoire visuel des signaux médiatiques mondiaux : événements localisés, sources et tendances, avec une méthode transparente.",
  keywords: ["actualité mondiale", "carte du monde", "GDELT", "RSS", "signaux médiatiques", "Le Pouls du Monde"],
  openGraph: {
    title: "Le Pouls du Monde",
    description: "Voir les signaux médiatiques mondiaux prendre forme sur une carte vivante.",
    type: "website",
    locale: "fr_FR",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#051117",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
