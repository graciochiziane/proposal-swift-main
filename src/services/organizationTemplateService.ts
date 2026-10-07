// ============================================================
// OrganizationTemplateService — associação organização→modelo PDF
//
// Implementação Supabase do resolver (a consulta injectada no
// resolver puro de src/lib/pdf/resolver.ts) + CRUD para o painel
// de administração (aba Templates do TenantDetailPage).
//
// Segurança: TODAS as queries passam pela RLS da tabela
// organization_templates (user_belongs_to_org por linha) — o
// organizationId recebido é, no máximo, uma dica de UX; um
// pedido que tente ler templates de outra org devolve 0 linhas.
//
// Regra de degradação: nenhuma função lança por falha de leitura;
// o resolver devolve sempre um PdfTemplateId válido (fallback).
// As funções de escrita LANÇAM (o admin precisa de ver o erro).
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { resolverTemplateParaOrg } from '@/lib/pdf/resolver';
import { obterTemplateInfo } from '@/lib/pdf/templates';
import { TEMPLATES_PDF } from '@/lib/pdf/templates';
import type { PdfTemplateId } from '@/lib/pdf/tipos';

/** Linha de organization_templates (espelho do schema) */
export interface OrganizationTemplate {
  id: string;
  organization_id: string;
  template_key: string;
  nome: string;
  is_active: boolean;
  is_default: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const TABELA = 'organization_templates' as const;

function paraTemplate(row: Record<string, unknown>): OrganizationTemplate {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    template_key: row.template_key as string,
    nome: row.nome as string,
    is_active: row.is_active as boolean,
    is_default: row.is_default as boolean,
    config: (row.config ?? {}) as Record<string, unknown>,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const OrganizationTemplateService = {
  /**
   * Consulta a chave do template default ACTIVO da org
   * (a consulta injectada no resolver puro). RLS filtra linhas
   * alheias → null. Nunca lança.
   */
  async consultarTemplateDefault(organizationId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from(TABELA)
        .select('template_key')
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) return null; // erro → "sem linha" → fallback
      return (data?.template_key as string | undefined) ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Resolve o template efectivo da organização activa com a cadeia
   * de fallback da proposta (org > fallback do caller). Nunca lança.
   * Org sem linhas → devolve o fallback (comportamento actual).
   */
  async resolverTemplateParaOrganizacao(
    organizationId: string | null | undefined,
    fallback: PdfTemplateId,
  ): Promise<PdfTemplateId> {
    return resolverTemplateParaOrg(organizationId, fallback, (orgId) =>
      OrganizationTemplateService.consultarTemplateDefault(orgId));
  },

  /** Lista as linhas da org (default primeiro). Lança em erro de leitura. */
  async listar(organizationId: string): Promise<OrganizationTemplate[]> {
    const { data, error } = await supabase
      .from(TABELA)
      .select('*')
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => paraTemplate(r));
  },

  /**
   * Define a linha indicada como default da org (limpa o default
   * anterior e re-activa a linha). Ordem: limpar → promover.
   * Se o passo de promover falhar, a org fica sem default →
   * o resolver devolve o fallback (degradação segura, nunca erro
   * de exportação).
   */
  async definirComoDefault(templateId: string): Promise<void> {
    // 1. limpar o default actual (idempotente)
    const { data: linha, error: errLeitura } = await supabase
      .from(TABELA)
      .select('organization_id')
      .eq('id', templateId)
      .maybeSingle();
    if (errLeitura || !linha) throw new Error(errLeitura?.message ?? 'Template não encontrado');

    const { error: errLimpar } = await supabase
      .from(TABELA)
      .update({ is_default: false })
      .eq('organization_id', linha.organization_id)
      .eq('is_default', true);
    if (errLimpar) throw new Error(errLimpar.message);

    // 2. promover (e re-activar) a linha escolhida
    const { error: errPromover } = await supabase
      .from(TABELA)
      .update({ is_default: true, is_active: true })
      .eq('id', templateId);
    if (errPromover) throw new Error(errPromover.message);
  },

  /** Activa/desactiva uma linha (desactivar default = fallback imediato). */
  async definirActivo(templateId: string, is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from(TABELA)
      .update({ is_active })
      .eq('id', templateId);
    if (error) throw new Error(error.message);
  },

  /** Remove a linha (higiene; CASCADE org já cobre o delete da org). */
  async remover(templateId: string): Promise<void> {
    const { error } = await supabase
      .from(TABELA)
      .delete()
      .eq('id', templateId);
    if (error) throw new Error(error.message);
  },

  /**
   * Cria uma linha para a org a partir de um modelo base do registry
   * (operação "adicionar modelo ao tenant"). Se marcar default,
   * limpa o default anterior ANTES de inserir (ordem de segurança
   * do índice único parcial).
   */
  async criar(input: {
    organization_id: string;
    template_key: PdfTemplateId;
    nome?: string;
    is_default?: boolean;
  }): Promise<OrganizationTemplate> {
    const nome = input.nome?.trim() || obterTemplateInfo(input.template_key).nome;

    if (input.is_default) {
      const { error: errLimpar } = await supabase
        .from(TABELA)
        .update({ is_default: false })
        .eq('organization_id', input.organization_id)
        .eq('is_default', true);
      if (errLimpar) throw new Error(errLimpar.message);
    }

    const { data, error } = await supabase
      .from(TABELA)
      .insert({
        organization_id: input.organization_id,
        template_key: input.template_key,
        nome,
        is_active: true,
        is_default: input.is_default ?? false,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return paraTemplate(data as Record<string, unknown>);
  },
};

/** Chaves válidas para os selects da UI admin (fonte: registry em código) */
export function chavesTemplatesDisponiveis(): { id: PdfTemplateId; nome: string }[] {
  return TEMPLATES_PDF.map(t => ({ id: t.id, nome: t.nome }));
}
