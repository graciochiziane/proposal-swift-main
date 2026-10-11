// ============================================================
// Shared Gemini helpers for Supabase Edge Functions
// P1-H9 (2026-08-13): Allowlist of allowed Gemini models
//   Prevents cost injection via caller-supplied model parameter.
//   Previously: caller could pass model='gemini-1.5-pro' (expensive)
//   and the Edge Function would use it without validation.
// ============================================================

/**
 * Allowlist of Gemini models that can be used by Edge Functions.
 * Add new models here when Google releases them.
 * Order: prefer cheaper models first (used as default).
 */
export const ALLOWED_GEMINI_MODELS: readonly string[] = [
  "gemini-3.1-flash-lite",     // Default — cheapest, fastest
  "gemini-3.1-pro-preview",    // Alias returned by API for some flash models
  "gemini-2.5-flash",          // Legacy fallback (still used in some clients)
  "gemini-2.0-flash",          // Older but stable
  "gemini-1.5-flash",          // Oldest supported
];

/**
 * Default model when caller doesn't specify or specifies an invalid one.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

/**
 * Validates that the provided model is in the allowlist.
 * Returns the model if valid, otherwise returns the default.
 * This prevents callers from injecting expensive models like
 * 'gemini-1.5-pro' that would inflate API costs.
 */
export function validateGeminiModel(model: string | undefined): string {
  if (!model || typeof model !== "string") {
    return DEFAULT_GEMINI_MODEL;
  }
  return ALLOWED_GEMINI_MODELS.includes(model) ? model : DEFAULT_GEMINI_MODEL;
}
