import { SITE_ORIGIN } from "../lib/site-metadata.js";

const routes = [
  ["/", "daily", 1],
  ["/carte-actualite-mondiale", "weekly", 0.9],
  ["/methode-localisation-actualite", "monthly", 0.85],
  ["/sources-rss-internationales", "weekly", 0.85],
  ["/a-propos", "monthly", 0.7],
  ["/sante-sources", "daily", 0.65],
  ["/confidentialite", "yearly", 0.3],
  ["/mentions-legales", "yearly", 0.3],
];

export default function sitemap() {
  return routes.map(([path, changeFrequency, priority]) => ({
    url: `${SITE_ORIGIN}${path}`,
    changeFrequency,
    priority,
  }));
}
