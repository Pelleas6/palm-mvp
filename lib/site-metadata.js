export const SITE_ORIGIN = "https://ma-ligne-de-vie.fr";
export const SITE_NAME = "Le Pouls du Monde";
export const SITE_DESCRIPTION = "Observatoire cartographique de l'actualité mondiale à partir de sources publiques, avec localisation prudente et méthode transparente.";

export function pageMetadata({ title, description, path }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      locale: "fr_FR",
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
