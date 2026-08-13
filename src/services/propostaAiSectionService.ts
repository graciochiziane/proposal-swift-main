// ============================================================
// AI Section Generation Service
// Chama Edge Function 'generate-section' para gerar conteúdo IA.
//
// P0-C1 (2026-08-13): Removed direct Gemini fallback.
//   Previously this service had a fallback to geminiClient.ts which
//   contained a hardcoded API key exposed in the client bundle.
//   Now uses Edge Function exclusively — key stays server-side.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type { AIGenerationInput, AIGenerationOutput } from '@/types/advancedProposal';
import { saveSectionAIContent, updateAdvancedProposalStatus } from './advancedProposalService';

// --- Retry config ---
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Gera conteudo AI para uma seccao especifica.
 * Chama Edge Function 'generate-section' com retry.
 * Se todos os retries falharem, lanca erro (sem fallback directo).
 */
export async function generateSectionContent(
  input: AIGenerationInput,
): Promise<AIGenerationOutput> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-section', {
        body: {
          sectionId: input.sectionId,
          sectionTitle: input.sectionTitle,
          sectionType: input.sectionType,
          contentRules: input.contentRules,
          questions: input.questions.map(q => ({
            id: q.id,
            question_text: q.question_text,
          })),
          answers: input.answers,
          companyInfo: input.companyInfo,
          clientInfo: input.clientInfo,
          previousSections: input.previousSections,
        },
      });

      if (!error && !data?.error) {
        return {
          sectionId: data.sectionId || input.sectionId,
          content: data.content || '',
          warnings: data.warnings || [],
          missingInformation: data.missingInformation || [],
        };
      }

      // Edge function returned error body
      const errMsg = error?.message || data?.error || 'Unknown error';
      lastError = new Error(errMsg);
      console.warn(`[AI] Edge Function attempt ${attempt + 1} failed:`, errMsg);

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] Edge Function attempt ${attempt + 1} exception:`, lastError);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }

  // P0-C1: Sem fallback directo ao Gemini — lança erro para o caller tratar.
  // A Edge Function é a única via (key fica server-side, não no client bundle).
  throw new Error(
    `Falha ao gerar secção após ${MAX_RETRIES + 1} tentativas. ` +
    `Verifique sua conexão e tente novamente. Último erro: ${lastError?.message || 'desconhecido'}`
  );
}

/**
 * Gera todas as seccoes de uma proposta em sequencia.
 * Cada seccao e gerada com contexto das anteriores.
 * Salva automaticamente no DB.
 */
export async function generateAllSections(params: {
  proposalId: string;
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    sectionType: string;
    contentRules: any;
    questions: any[];
    answers: Record<string, string>;
    answerId: string;
  }>;
  companyInfo: AIGenerationInput['companyInfo'];
  clientInfo: AIGenerationInput['clientInfo'];
  onProgress?: (sectionIndex: number, total: number, status: string) => void;
}): Promise<AIGenerationOutput[]> {
  const results: AIGenerationOutput[] = [];
  const previousSections: { title: string; content: string }[] = [];
  let hasErrors = false;

  for (let i = 0; i < params.sections.length; i++) {
    const section = params.sections[i];
    params.onProgress?.(i, params.sections.length, `A gerar: ${section.sectionTitle}`);

    try {
      const output = await generateSectionContent({
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        sectionType: section.sectionType,
        contentRules: section.contentRules,
        questions: section.questions,
        answers: section.answers,
        companyInfo: params.companyInfo,
        clientInfo: params.clientInfo,
        previousSections,
      });

      // Save AI content to DB
      // P0-C1/H12: usar modelo consistente com Edge Function (gemini-3.1-flash-lite)
      // Tokens reais virão da Edge Function no futuro; por ora 0 (audit H10 tracking)
      await saveSectionAIContent(
        section.answerId,
        output.content,
        'gemini-3.1-flash-lite',
        0,
      );

      previousSections.push({ title: section.sectionTitle, content: output.content });
      results.push(output);
    } catch (err) {
      hasErrors = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AI] Error generating section ${section.sectionTitle}:`, errMsg);
      params.onProgress?.(i, params.sections.length, `Erro em: ${section.sectionTitle}`);
      results.push({
        sectionId: section.sectionId,
        content: '',
        warnings: [`Erro ao gerar: ${errMsg}`],
        missingInformation: [],
      });
    }
  }

  // Only auto-conclude if all sections generated successfully
  if (!hasErrors) {
    await updateAdvancedProposalStatus(params.proposalId, 'concluida');
  }
  params.onProgress?.(params.sections.length, params.sections.length, hasErrors ? 'Concluido com erros' : 'Concluido');

  return results;
}
