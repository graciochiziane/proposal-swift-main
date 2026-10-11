// ============================================================
// Supabase Edge Function: send-invite-email
// Recebe: { invitation_id, organization_id, email, role, org_nome }
// Envia email com link de aceite usando Resend
//
// P0-C3 (2026-08-13): Added JWT verification
// P0-C4 (2026-08-13): Replaced CORS '*' with allowlist
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

interface InvitePayload {
  invitation_id: string;
  organization_id: string;
  email: string;
  role: string;
  org_nome: string;
  token: string;
}

function roleLabel(role: string): string {
  switch (role) {
    case "owner": return "Dono";
    case "admin": return "Administrador";
    case "member": return "Membro";
    case "viewer": return "Observador";
    default: return role;
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    // ---- P0-C3: JWT verification ----
    const auth = await verifyAuth(req);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error.message, step: auth.error.step }),
        {
          status: auth.error.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { invitation_id, organization_id, email, role, org_nome, token }: InvitePayload = await req.json();

    if (!email || !token) {
      return new Response(JSON.stringify({ error: "email e token sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar o token do convite (pode ter sido gerado pelo DB default)
    // O token ja vem do payload, mas vamos confirmar via DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invite, error: inviteError } = await supabase
      .from("organization_invitations")
      .select("token")
      .eq("id", invitation_id)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Convite nao encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acceptUrl = `${Deno.env.get("APP_URL") || "https://proposal-swift-staging.vercel.app"}/invite/accept?token=${invite.token}`;

    // Enviar via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      // Sem API key: logar e nao falhar (o convite existe, so nao tem email)
      console.log(`[send-invite-email] RESEND_API_KEY nao configurada. Convite ${invitation_id} criado sem email.`);
      return new Response(JSON.stringify({ success: true, warning: "email_nao_enviado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PropostaJa <noreply@propostaja.com>",
        to: [email],
        subject: `Convite para ${org_nome} no PropostaJa`,
        html: `
          <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <div style="padding: 24px 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Proposta<span style="color: #6366f1;">Ja</span></h1>
            </div>
            <div style="background: #f9fafb; border-radius: 12px; padding: 32px; text-align: center;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 8px;">
                Foi convidado para se juntar a
              </p>
              <p style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">
                ${org_nome}
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">
                Role: <strong>${roleLabel(role)}</strong>
              </p>
              <a href="${acceptUrl}"
                 style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Aceitar Convite
              </a>
              <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0;">
                Este link expira em 7 dias. Se nao pediu este convite, ignore este email.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error(`[send-invite-email] Resend error: ${emailResponse.status} - ${errBody}`);
      return new Response(JSON.stringify({ error: "falha_ao_enviar_email", status: emailResponse.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-invite-email] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "erro_interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
