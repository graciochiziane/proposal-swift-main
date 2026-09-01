// ============================================================
// Envio de Propostas por Email (PDF anexo)
//
// Gera o PDF no browser (vectorial) e envia-o em base64 à edge
// function send-proposal-email (Resend), que o entrega ao
// cliente com template de email da marca.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { pdfPropostaBase64 } from '@/lib/pdf/gerar';
import { nomeFicheiroPdf } from '@/lib/pdf/utils';
import type { DadosPropostaPdf, PdfTemplateId } from '@/lib/pdf/tipos';

export interface EnviarPropostaInput {
  dados: DadosPropostaPdf;
  templateId: PdfTemplateId;
  /** email do destinatário (cliente) */
  para: string;
  assunto?: string;
  /** mensagem personalizada no corpo do email */
  mensagem?: string;
}

export interface EnviarPropostaResultado {
  sucesso: boolean;
  /** true quando a RESEND_API_KEY não está configurada no Supabase */
  avisoSemApiChave?: boolean;
  erro?: string;
}

export const propostaEmailService = {
  /**
   * Gera o PDF e envia-o ao cliente por email.
   * Não lança — devolve { sucesso, avisoSemApiChave, erro }.
   */
  async enviar(input: EnviarPropostaInput): Promise<EnviarPropostaResultado> {
    const { dados, templateId, para, assunto, mensagem } = input;

    if (!para?.trim()) {
      return { sucesso: false, erro: 'Indique o email do destinatário.' };
    }

    try {
      const base64 = pdfPropostaBase64(dados, templateId);
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          para: para.trim(),
          assunto,
          mensagem,
          nome_cliente: dados.cliente.nome || '',
          nome_empresa: dados.empresa.nome || '',
          numero_proposta: dados.numero,
          pdf_base64: base64,
          pdf_filename: nomeFicheiroPdf(`Proposta-${dados.numero}`),
        },
      });

      if (error) {
        return { sucesso: false, erro: 'Falha na comunicação com o serviço de email.' };
      }

      const resultado = data as { success?: boolean; warning?: string; error?: string };
      if (resultado?.warning === 'email_nao_enviado_sem_api_key') {
        return { sucesso: true, avisoSemApiChave: true };
      }
      if (!resultado?.success) {
        return { sucesso: false, erro: resultado?.error || 'O email não foi enviado.' };
      }
      return { sucesso: true };
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : 'Erro inesperado.' };
    }
  },
};
