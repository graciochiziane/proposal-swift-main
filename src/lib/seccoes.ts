// ============================================================
// Labels canónicos das secções de narrativa IA
//
// Módulo puro (sem dependência de serviços/Supabase) para ser
// partilhado pelo serviço de IA e pelo conversor de PDF.
// ============================================================

/** Labels das secções na ordem canónica do documento */
export const SECTION_LABELS: Record<string, string> = {
  contexto: 'Contexto do Cliente',
  problema: 'Problema Identificado',
  solucao: 'Solucao Proposta',
  beneficios: 'Beneficios Esperados',
  impacto: 'Impacto Quantificavel',
  escopo: 'Escopo Detalhado',
  cronograma: 'Cronograma',
  condicoes: 'Condicoes Especiais',
  investimento: 'Resumo de Investimento',
};

/** Ordem canónica de impressão das secções */
export const ORDEM_SECCOES: string[] = Object.keys(SECTION_LABELS);
