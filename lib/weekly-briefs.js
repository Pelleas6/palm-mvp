import briefs from "../content/briefs.json" with { type: "json" };

function toTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isPublicBrief(brief) {
  return brief && brief.status === "published" && typeof brief.slug === "string" && brief.slug.length > 0;
}

export function getPublishedBriefs() {
  return [...briefs]
    .filter(isPublicBrief)
    .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt));
}

export function getPublishedBriefBySlug(slug) {
  return getPublishedBriefs().find((brief) => brief.slug === slug) || null;
}

export function formatBriefDate(value, { long = false } = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non précisée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  }).format(date);
}
