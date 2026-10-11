// ============================================================
// Shared CORS helpers for Supabase Edge Functions
// P0-C4 (2026-08-13): Replace wildcard '*' with origin allowlist
// ============================================================

/**
 * Allowed origins for CORS.
 * Add production and preview URLs here.
 * Localhost variants for development.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  // Production
  "https://proposta2.vercel.app",
  // Staging / preview
  "https://proposal-swift-staging.vercel.app",
  // Local development
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

/**
 * Returns CORS headers with the request's Origin reflected only if it is in the allowlist.
 * If the origin is not allowed, returns an empty Access-Control-Allow-Origin header
 * which causes the browser to block the response.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns a Response if the request is a preflight, or null otherwise.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
