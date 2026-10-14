// ============================================================
// Shared CORS helpers for Supabase Edge Functions
// P0-C4 (2026-08-13): Replace wildcard '*' with origin allowlist
// Fix regressão v11 (2026-10-13): a allowlist estática não cobria os
// preview deployments do Vercel (URLs dinâmicas por branch/commit),
// logo o preflight devolvia 200 SEM Access-Control-Allow-Origin e o
// browser bloqueava o POST (logs só mostravam OPTIONS | 200).
// Fix 2026-10-14: o projecto Vercel antigo (proposta2) ficou DESACTIVADO
// por billing (402 DEPLOYMENT_DISABLED) e o frontend passou a ser testado
// noutras superfícies — propostaja.vercel.app (projecto actual da marca),
// previews do projecto de staging (proposal-swift-staging-git-*) e
// localhost noutros portos. Nenhuma delas era aceite pelo preflight
// (sintoma idêntico à v11: "Failed to send a request to the Edge
// Function" após 3 retries do propostaAiSectionService).
// ============================================================

/**
 * Allowed origins for CORS.
 * Add production and preview URLs here.
 * (Desenvolvimento local é coberto por ALLOWED_ORIGIN_PATTERNS.)
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  // Production — projecto Vercel antigo (desactivado por billing em 2026-10-14;
  // mantido para quando for reactivado)
  "https://proposta2.vercel.app",
  // Projecto actual da marca PropostaJá
  "https://propostaja.vercel.app",
  // Staging
  "https://proposal-swift-staging.vercel.app",
];

/**
 * Padrões de preview deployments do Vercel deste projecto (URLs dinâmicas):
 * - proposta2-git-<branch>-<scope>.vercel.app            (preview de branch)
 * - proposta2-<commit-hash>-<scope>.vercel.app           (preview de commit)
 * Idem para propostaja (marca) e proposal-swift-staging (staging).
 * Desenvolvimento local: localhost/127.0.0.1 em QUALQUER porto (o Vite
 * incrementa para 5174+ quando o 5173 está ocupado).
 * Mantém a postura P0-C4: apenas deployments do próprio projecto e
 * loopback local, nunca wildcard '*' nem origens arbitrárias de terceiros.
 */
const ALLOWED_ORIGIN_PATTERNS: readonly RegExp[] = [
  /^https:\/\/proposta2-[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/propostaja-[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/proposal-swift-staging-[a-z0-9-]+\.vercel\.app$/,
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
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
