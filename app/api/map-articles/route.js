import {
  getWorldPulseDashboardPayload,
  responseHeadersForPayload,
} from "../../../lib/world-pulse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalized(value) {
  return cleanText(value).toLocaleLowerCase("fr");
}

function compactArticle(article) {
  return {
    id: article?.id || null,
    title: cleanText(article?.title, "Article sans titre"),
    url: article?.url || null,
    mediaName: cleanText(article?.mediaName || article?.domain, "Source"),
    domain: cleanText(article?.domain),
    label: cleanText(article?.label, "Non classé"),
    eventCountry: cleanText(article?.eventCountry, "Monde"),
    eventCountryIso: cleanText(article?.eventCountryIso),
    sourceCountry: cleanText(article?.sourceCountry),
    sourceRegion: cleanText(article?.sourceRegion),
    language: cleanText(article?.language),
    seenAt: article?.seenAt || null,
  };
}

function articleHeaders(payload) {
  const headers = new Headers(responseHeadersForPayload(payload));
  headers.set(
    "Cache-Control",
    "public, max-age=20, s-maxage=60, stale-while-revalidate=300",
  );
  headers.set("Vary", "Accept-Encoding");
  return headers;
}

export async function GET(request) {
  try {
    const payload = await getWorldPulseDashboardPayload();
    const params = request.nextUrl.searchParams;
    const articleId = cleanText(params.get("articleId"));
    const category = cleanText(params.get("category"));
    const country = cleanText(params.get("country")).toUpperCase();
    const source = cleanText(params.get("source"));
    const limit = Math.min(Math.max(Number(params.get("limit")) || 16, 1), 30);

    let articles = Array.isArray(payload?.articles) ? payload.articles : [];

    if (articleId) {
      articles = articles.filter((article) => String(article?.id || "") === articleId);
    }
    if (category) {
      const expected = normalized(category);
      articles = articles.filter((article) => normalized(article?.label) === expected);
    }
    if (country) {
      articles = articles.filter(
        (article) => String(article?.eventCountryIso || "").toUpperCase() === country,
      );
    }
    if (source) {
      const expected = normalized(source);
      articles = articles.filter(
        (article) =>
          normalized(article?.mediaName) === expected ||
          normalized(article?.domain) === expected,
      );
    }

    const body = {
      generatedAt: payload?.generatedAt || new Date().toISOString(),
      total: articles.length,
      articles: articles.slice(0, limit).map(compactArticle),
    };

    return Response.json(body, {
      headers: articleHeaders(payload),
    });
  } catch (error) {
    console.error("Map articles route error:", error);
    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        total: 0,
        articles: [],
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  }
}
