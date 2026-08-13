// ============================================================
// Shared auth helpers for Supabase Edge Functions
// P0-C3 (2026-08-13): Enforce JWT verification on all functions
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Result of verifying the JWT in a request.
 */
export interface AuthResult {
  user: { id: string; email?: string } | null;
  supabaseUser: ReturnType<typeof createClient>;
  error?: { status: number; message: string; step: string };
}

/**
 * Verifies the Authorization header of a request and returns the authenticated user
 * plus a Supabase client configured with the user's JWT (respects RLS).
 *
 * Usage:
 *   const auth = await verifyAuth(req);
 *   if (auth.error) {
 *     return new Response(JSON.stringify({ error: auth.error.message, step: auth.error.step }), {
 *       status: auth.error.status,
 *       headers: { ...corsHeaders, "Content-Type": "application/json" },
 *     });
 *   }
 *   // auth.user.id, auth.supabaseUser are now safe to use
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return {
      user: null,
      supabaseUser: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      ),
      error: {
        status: 401,
        message: "Token de autenticacao nao fornecido",
        step: "auth",
      },
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Service-role client for admin operations (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return {
      user: null,
      supabaseUser: createClient(supabaseUrl, supabaseAnonKey),
      error: {
        status: 401,
        message: "Utilizador nao autenticado",
        step: "auth",
      },
    };
  }

  // Client with JWT do utilizador para respeitar RLS (org-scoped access)
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { user, supabaseUser };
}
