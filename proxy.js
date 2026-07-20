import { NextResponse } from "next/server";

const CANONICAL_HOST = "ma-ligne-de-vie.fr";
const CANONICAL_ALIASES = new Set([
  "www.ma-ligne-de-vie.fr",
  "palm-mvp-ma-ligne-de-vie.vercel.app",
  "palm-mvp-git-main-ma-ligne-de-vie.vercel.app",
]);

// URL publiques de l'ancien service de lecture de mains. Elles doivent rester
// explorables afin que les moteurs constatent leur suppression définitive.
const LEGACY_PUBLIC_PATHS = new Set([
  "/ligne-de-coeur",
  "/ligne-de-tete",
  "/lecture-main-gauche-droite",
  "/lecture-de-main",
  "/lecture-de-mains",
  "/analyse-main",
  "/analyse-de-main",
  "/analyse-energetique",
  "/commande",
  "/paiement",
  "/merci",
  "/confirmation",
  "/upload",
  "/rapport",
  "/resultat",
]);

// Anciens endpoints privés. Le proxy les neutralise même si une ancienne
// fonction devait encore subsister dans l'historique ou un déploiement.
const LEGACY_API_PATHS = new Set([
  "/api/analyze",
  "/api/create-checkout",
  "/api/create-checkout-session",
  "/api/process-job",
  "/api/send-otp",
  "/api/verify-otp",
  "/api/upload",
  "/api/upload-url",
  "/api/stripe-webhook",
  "/api/webhook",
]);

function normalizedPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function requestHost(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.hostname;
  return String(host || "").split(":")[0].trim().toLowerCase();
}

function retiredPageResponse() {
  return new NextResponse(
    "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow,noarchive,nosnippet\"><title>Contenu supprimé</title></head><body><main><h1>Contenu définitivement supprimé</h1><p>L'ancien service de lecture de mains n'existe plus sur ce domaine.</p><p><a href=\"/\">Accéder au Pouls du Monde</a></p></main></body></html>",
    {
      status: 410,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=86400",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      },
    },
  );
}

function retiredApiResponse() {
  return NextResponse.json(
    { error: "Endpoint définitivement supprimé." },
    {
      status: 410,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      },
    },
  );
}

export function proxy(request) {
  const host = requestHost(request);
  const pathname = normalizedPath(request.nextUrl.pathname);

  // Une seule version publique et indexable du site.
  if (CANONICAL_ALIASES.has(host)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.hostname = CANONICAL_HOST;
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (LEGACY_PUBLIC_PATHS.has(pathname)) return retiredPageResponse();
  if (LEGACY_API_PATHS.has(pathname)) return retiredApiResponse();

  const response = NextResponse.next();

  // Les déploiements de prévisualisation restent testables mais ne doivent
  // jamais créer de doublons dans les résultats des moteurs de recherche.
  if (host.endsWith(".vercel.app")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
