export const metadata = {
  title: "Lecture de Mains",
  description: "Analyse énergétique personnalisée",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  );
}
