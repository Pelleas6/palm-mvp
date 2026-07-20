import { notFound } from "next/navigation";
import WeeklyBriefLayout from "../../../components/WeeklyBriefLayout";
import { getPublishedBriefBySlug, getPublishedBriefs } from "../../../lib/weekly-briefs.js";
import { SITE_NAME, SITE_ORIGIN } from "../../../lib/site-metadata.js";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedBriefs().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const brief = getPublishedBriefBySlug(slug);
  if (!brief) return {};
  const title = `${brief.title} | ${SITE_NAME}`;
  const description = brief.standfirst;
  const path = `/brief-mondial/${brief.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "article", locale: "fr_FR", siteName: SITE_NAME },
    twitter: { card: "summary", title, description },
    robots: brief.pilot ? { index: false, follow: true } : undefined,
  };
}

export default async function BriefArticlePage({ params }) {
  const { slug } = await params;
  const brief = getPublishedBriefBySlug(slug);
  if (!brief) notFound();

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: brief.title,
    description: brief.standfirst,
    datePublished: brief.publishedAt,
    dateModified: brief.publishedAt,
    mainEntityOfPage: `${SITE_ORIGIN}/brief-mondial/${brief.slug}`,
    inLanguage: "fr-FR",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };

  return (
    <>
      <WeeklyBriefLayout brief={brief} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
