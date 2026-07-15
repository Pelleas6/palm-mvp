export const metadata = {
  title: "Le Pouls du Monde | Palm",
  description: "Tableau de bord GDELT des signaux médiatiques mondiaux.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
