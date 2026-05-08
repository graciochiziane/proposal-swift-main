import { supabase } from '@/integrations/supabase/client';

// ---- Types ----

export type GeracaoMode = 'rapido' | 'assertivo';
export type TomNarrativa = 'formal' | 'persuasivo' | 'tecnico' | 'consultivo';

export interface PropostaAiFields {
  contexto?: string;
  problema?: string;
  solucao?: string;
  beneficios?: string;
  impacto?: string;
  escopo?: string;
  cronograma?: string;
  condicoes?: string;
}

export interface PropostaAiRecord {
  id: string;
  cotacao_id: string;
  user_id: string;
  referencia: string | null;
  mode: GeracaoMode;
  tone: TomNarrativa;
  sector: string | null;
  input_json: PropostaAiFields | null;
  output_json: Record<string, string> | null;
  edited_json: Record<string, string> | null;
  modelo: string | null;
  tokens_usados: number;
  custo_usd: number;
  gerado_em: string | null;
  exportado_em: string | null;
  created_at: string;
}

export interface GenerateResult {
  id: string;
  referencia: string;
  seccoes: Record<string, string>;
  modelo: string;
  tokens_usados: number;
  gerado_em: string;
}

// ---- Labels ----

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

export const BASE_FIELDS = ['contexto', 'problema', 'solucao', 'beneficios'] as const;
export const ADVANCED_FIELDS = ['impacto', 'escopo', 'cronograma', 'condicoes'] as const;

export const TOM_OPTIONS: { value: TomNarrativa; label: string; desc: string }[] = [
  { value: 'formal', label: 'Formal Corporativo', desc: 'Bancos, auditorias, procurement' },
  { value: 'persuasivo', label: 'Persuasivo', desc: 'Vendas, conversao, impacto' },
  { value: 'tecnico', label: 'Tecnico Directo', desc: 'TI, engenharia, especificacoes' },
  { value: 'consultivo', label: 'Consultivo', desc: 'Assessoria, estrategia, advisory' },
];

export const SECTOR_OPTIONS = [
  'Bank / Servicos Financeiros',
  'Telecomunicacoes',
  'Governo / Sector Publico',
  'Retalho / Comercio',
  'ONG / Organizacoes',
  'Energia / Recursos',
  'Saude',
  'Educacao',
  'Seguros',
  'Transportes / Logistica',
  'Imobiliaria / Construcao',
  'Outro',
];

// ---- Placeholders (exemplos mocambicanos) ----

export const FIELD_PLACEHOLDERS: Record<string, string> = {
  contexto: 'Ex: O MozaBank e um dos maiores bancos de Mocambique, com 45 agencias e mais de 800 colaboradores. A direccao de TI gere actualmente mais de 30 sistemas internos, muitos dos quais desenvolvidos internamente ha mais de 8 anos.',
  problema: 'Ex: O processo de aprovacao de credito demora em media 14 dias uteis, contra uma meta interna de 5 dias. Isto deve-se a workflows manuais, falta de integracao entre sistemas, e retrabalho por erros de introducao de dados.',
  solucao: 'Ex: Propomos a implementacao de uma plataforma de gestao de credito digital, composta por modulos integrados que automatizam o processo de ponta a ponta.',
  beneficios: 'Ex: Reducao do tempo de aprovacao de 14 para 5 dias; Eliminacao de erros manuais (estimado: 4.5M MT recuperados/ano); Visibilidade em tempo real do pipeline de credito; Conformidade com as directrizes do Banco de Mocambique.',
  impacto: 'Ex: O atraso medio de 9 dias extra custa ao banco aproximadamente 4.500.000,00 MT/ano em perdas por juros nao capitalizados e custos operacionais adicionais.',
  escopo: 'Ex: O escopo inclui: Levantamento e mapeamento de processos; Desenvolvimento e configuracao dos modulos; Migracao de dados historicos; Formacao de 15 colaboradores; 12 meses de suporte tecnico.',
  cronograma: 'Ex: Inicio: 01 Jun 2026 | Fim: 30 Nov 2026 | 3 fases: Analise e Design (4 sem), Desenvolvimento (12 sem), Formacao e Transicao (4 sem)',
  condicoes: 'Ex: Requer-se acesso a um representante do lado do cliente para validacoes semanais. O pagamento sera dividido em 3 parcelas: 40% a assinatura, 30% na entrega da fase 2, e 30% na entrega final.',
};

// ---- Service ----

export const propostaAiService = {

  /**
   * Gerar proposta via Edge Function
   */
  async generate(
    cotacaoId: string,
    fields: PropostaAiFields,
    tone: TomNarrativa,
    mode: GeracaoMode,
    sector: string,
    model: string = 'gpt-4o-mini',
  ): Promise<GenerateResult> {
    const { data, error } = await supabase.functions.invoke('generate-proposal', {
      body: { cotacaoId, fields, tone, mode, sector, model },
    });

    if (error) {
      console.error('Edge function error [status]:', error.message);
      // Tenta extrair mensagem detalhada do erro
      const detail = (error as any).context?.status || '';
      const msg = detail
        ? `Erro ${detail}: ${error.message}`
        : error.message || 'Erro ao gerar proposta';
      throw new Error(msg);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data as GenerateResult;
  },

  /**
   * Buscar proposta IA salva (por cotacao_id)
   */
  async getByCotacao(cotacaoId: string): Promise<PropostaAiRecord | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await supabase
      .from('proposta_ai')
      .select('*')
      .eq('cotacao_id', cotacaoId)
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar proposta AI:', error);
      return null;
    }

    return data as PropostaAiRecord | null;
  },

  /**
   * Buscar proposta AI por ID (verifica ownership)
   */
  async getById(id: string): Promise<PropostaAiRecord | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await supabase
      .from('proposta_ai')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar proposta AI:', error);
      return null;
    }

    return data as PropostaAiRecord | null;
  },

  /**
   * Guardar edicoes do utilizador
   */
  async saveEdited(id: string, editedJson: Record<string, string>): Promise<void> {
    const { error } = await supabase
      .from('proposta_ai')
      .update({ edited_json: editedJson })
      .eq('id', id);

    if (error) {
      console.error('Erro ao guardar edicoes:', error);
      throw new Error('Erro ao guardar edicoes');
    }
  },

  /**
   * Marcar como exportado (lanca erro se falhar)
   */
  async markExported(id: string): Promise<void> {
    const { error } = await supabase
      .from('proposta_ai')
      .update({ exportado_em: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Erro ao marcar exportado:', error);
      throw new Error('Erro ao marcar proposta como exportada');
    }
  },

  /**
   * Regenerar uma proposta existente (cria novo registo com novo ID)
   */
  async regenerate(
    cotacaoId: string,
    fields: PropostaAiFields,
    tone: TomNarrativa,
    mode: GeracaoMode,
    sector: string,
    model: string = 'gpt-4o-mini',
  ): Promise<GenerateResult> {
    return this.generate(cotacaoId, fields, tone, mode, sector, model);
  },

  /**
   * Detectar sector automaticamente a partir dos items da cotacao
   */
  detectSector(items: Array<{ nome: string }>): string {
    const allText = items.map(i => i.nome.toLowerCase()).join(' ');

    const sectorKeywords: Record<string, string[]> = {
      'Bank / Servicos Financeiros': ['banco', 'credit', 'banca', 'financ', 'core banking', 'atm', 'mbway', 'mpesa', 'conta', 'transacao', 'compliance', 'risk', 'kyc', 'aml'],
      'Telecomunicacoes': ['telecom', 'rede', 'torre', 'fibra', 'banda larga', 'gsm', 'lte', '5g', 'sms', 'ussd', 'mno', 'mvno', 'vodacom', 'mcel', 'tmcel'],
      'Governo / Sector Publico': ['governo', 'ministerio', 'municipal', 'tributacao', 'aduaneiro', 'eleitoral', 'civil', 'registo', 'documento', 'e-gov'],
      'Saude': ['saude', 'hospital', 'clinica', 'farmacia', 'paciente', 'medic', 'consult', 'laboratorio', 'pronto-socorro'],
      'Educacao': ['escola', 'universidade', 'ensino', 'aluno', 'professor', 'curriculo', 'avaliacao', 'educacao'],
      'Energia / Recursos': ['energia', 'solar', 'eletricidade', 'edm', 'petroleo', 'gas', 'mineral', 'carvao', 'hidroelectrica'],
      'Retalho / Comercio': ['retalho', 'loja', 'pos', 'stock', 'inventario', 'ecommerce', 'venda', 'cliente'],
      'Seguros': ['seguro', 'apolice', 'sinistro', 'prémio', 'cobertura', 'resseguro'],
      'Transportes / Logistica': ['transporte', 'logistica', 'frota', 'rastreamento', 'gps', 'carga', 'portuario', 'alfandega'],
      'Imobiliaria / Construcao': ['imobiliari', 'construcao', 'obra', 'projecto', 'arquitect', 'predial'],
    };

    let bestMatch = 'Outro';
    let bestScore = 0;

    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      const score = keywords.filter(kw => allText.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = sector;
      }
    }

    return bestScore > 0 ? bestMatch : 'Outro';
  },
};
