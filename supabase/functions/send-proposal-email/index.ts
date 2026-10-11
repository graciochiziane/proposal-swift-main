// ============================================================
// Supabase Edge Function: send-proposal-email
// Recebe: { para, assunto?, mensagem?, nome_cliente, nome_empresa,
//           numero_proposta, pdf_base64, pdf_filename }
// Envia a proposta (PDF anexo) ao cliente via Resend.
//
// P0-C3 (2026-09-01): JWT verification
// P0-C4 (2026-09-01): CORS allowlist (shared/cors.ts)
// Limites: pdf_base64 <= 3 MB (vectorial, tipicamente <300 KB)
// ============================================================

import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

interface PayloadProposta {
  para: string;
  assunto?: string;
  mensagem?: string;
  nome_cliente: string;
  nome_empresa: string;
  numero_proposta: string;
  pdf_base64: string;
  pdf_filename: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TAMANHO_MAX_BASE64 = 4_000_000; // ~3 MB de PDF

function escapeHtml(texto: string): string {
  return (texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonRes(corsHeaders: Record<string, string>, corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    // ---- P0-C3: JWT verification ----
    const auth = await verifyAuth(req);
    if (auth.error) {
      return jsonRes(corsHeaders, { error: auth.error.message, step: auth.error.step }, auth.error.status);
    }

    if (req.method !== "POST") {
      return jsonRes(corsHeaders, { error: "metodo_nao_permitido" }, 405);
    }

    const payload: PayloadProposta = await req.json();

    // ---- validações ----
    if (!payload.para || !EMAIL_RE.test(payload.para)) {
      return jsonRes(corsHeaders, { error: "email_destinatario_invalido" }, 400);
    }
    if (!payload.pdf_base64 || !payload.pdf_filename?.endsWith(".pdf")) {
      return jsonRes(corsHeaders, { error: "anexo_pdf_invalido" }, 400);
    }
    if (payload.pdf_base64.length > TAMANHO_MAX_BASE64) {
      return jsonRes(corsHeaders, { error: "pdf_demasiado_grande" }, 413);
    }

    const assunto =
      payload.assunto?.trim() ||
      `Proposta ${payload.numero_proposta} — ${payload.nome_empresa}`;
    const mensagem = payload.mensagem?.trim() || "";
    const nomeCliente = escapeHtml(payload.nome_cliente || "cliente");
    const nomeEmpresa = escapeHtml(payload.nome_empresa || "");
    const numero = escapeHtml(payload.numero_proposta || "");
    const mensagemHtml = mensagem
      ? `<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;">${escapeHtml(mensagem).replace(/\n/g, "<br/>")}</p>`
      : "";

    // ---- envio via Resend ----
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[send-proposal-email] RESEND_API_KEY nao configurada — email nao enviado.");
      return jsonRes(corsHeaders, { success: true, warning: "email_nao_enviado_sem_api_key" }, 200);
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PropostaJa <noreply@propostaja.com>",
        to: [payload.para],
        subject: assunto,
        html: `
          <div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
            <div style="padding:28px 0 20px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0;font-size:22px;color:#0f172a;">Proposta<span style="color:#6366f1;">Ja</span></h1>
              <p style="margin:6px 0 0;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">${nomeEmpresa}</p>
            </div>
            <div style="padding:28px 8px;">
              <p style="font-size:15px;margin:0 0 12px;">Olá, <strong>${nomeCliente}</strong>.</p>
              <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 8px;">
                A proposta comercial <strong>N. ${numero}</strong> de ${nomeEmpresa} vai em anexo a este email
                em formato PDF, pronta para consulta e impressão.
              </p>
              ${mensagemHtml}
              <div style="margin:24px 0 0;padding:16px 20px;background:#f8fafc;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;">
                <p style="margin:0;font-size:12px;color:#64748b;">
                  Este email foi enviado via plataforma PropostaJa. Se não esperava esta proposta, ignore-a.
                </p>
              </div>
            </div>
            <div style="padding:18px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">${nomeEmpresa} · Proposta N. ${numero}</p>
            </div>
          </div>`,
        attachments: [
          {
            filename: payload.pdf_filename,
            content: payload.pdf_base64,
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error(`[send-proposal-email] Resend error: ${emailResponse.status} - ${errBody}`);
      return jsonRes(corsHeaders, { error: "falha_ao_enviar_email", status: emailResponse.status }, 502);
    }

    return jsonRes(corsHeaders, { success: true }, 200);
  } catch (err) {
    console.error("[send-proposal-email] Unexpected error:", err);
    return jsonRes(corsHeaders, { error: "erro_interno" }, 500);
  }
});
