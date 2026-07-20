import WeeklyBriefLayout from "../../components/WeeklyBriefLayout";
import { getPublishedBriefs } from "../../lib/weekly-briefs.js";
import { pageMetadata } from "../../lib/site-metadata.js";

export const metadata = pageMetadata({
  title: "Le brief mondial | Le Pouls du Monde",
  description: "Les lectures éditoriales vérifiables de Le Pouls du Monde : signaux cartographiés, sources et limites de lecture.",
  path: "/brief-mondial",
});

export default function BriefMondialPage() {
  const [latestBrief] = getPublishedBriefs();

  return <WeeklyBriefLayout brief={latestBrief} index />;
}
