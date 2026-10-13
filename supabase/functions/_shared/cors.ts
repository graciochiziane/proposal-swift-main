// ============================================================
// Shared CORS helpers for Supabase Edge Functions
// P0-C4 (2026-08-13): Replace wildcard '*' with origin allowlist
// Fix regressão v11 (2026-10-13): a allowlist estática não cobria os
// preview deployments do Vercel (URLs dinâmicas por branch/commit),
// logo o preflight devolvia 200 SEM Access-Control-Allow-Origin e o
// browser bloqueava o POST (logs só mostravam OPTIONS | 200).
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
 * Padrões de preview deployments do Vercel deste projecto (URLs dinâmicas):
 * - proposta2-git-<branch>-<scope>.vercel.app   (preview de branch)
 * - proposta2-<commit-hash>-<scope>.vercel.app (preview de commit)
 * Mantém a postura P0-C4: apenas deployments do próprio projecto,
 * nunca wildcard '*' nem origens arbitrárias de terceiros.
 */
const ALLOWED_ORIGIN_PATTERNS: readonly RegExp[] = [
  /^https:\/\/proposta2-[a-z0-9-]+\.vercel\.app$/,
];

/**
 * Verifica se um Origin é permitido: allowlist estática
 * OU um padrão de preview deployment do próprio projecto no Vercel.
 */
export function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))
  );
}

/**
 * Returns CORS headers with the request's Origin reflected only if it is allowed.
 * If the origin is not allowed, returns an empty Access-Control-Allow-Origin header
 * which causes the browser to block the response.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = isOriginAllowed(origin) ? origin : "";

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
    const origin = req.headers.get("Origin") || "";
    if (!isOriginAllowed(origin)) {
      // Observabilidade: a regressão v11 era invisível nos logs
      // (preflight 200 + POST bloqueado pelo browser). Este warn
      // mostra a origin exacta que foi rejeitada.
      console.warn(`[CORS] Preflight rejeitado para origin: "${origin}"`);
    }
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
