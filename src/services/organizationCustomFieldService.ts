// ============================================================
// OrganizationCustomFieldService — campos personalizados da org
//
// CRUD para a UI de gestão (aba Perfil da Empresa) + leitura
// em mapa key→value para consumo pelos templates PDF.
//
// Segurança: TODAS as queries passam pela RLS da tabela
// organization_custom_fields (user_belongs_to_org por linha).
// O organizationId recebido é, no máximo, uma dica de UX.
//
// Regras:
//   - Escrita LANÇA (o admin precisa de ver o erro), após
//     validar chave/tipo/valor no módulo puro.
//   - Duplicada (field_key) na mesma org → erro amigável do
//     UNIQUE (organization_id, field_key).
//   - obterMapaActivos NUNCA lança (degrada para {} — os
//     templates ocultam os blocos sem dados).
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import {
  validarCampoPersonalizado,
  type TipoCampoPersonalizado,
} from '@/lib/camposPersonalizados';
import { OrganizationService } from './organizationService';
import type { DadosPropostaPdf } from '@/lib/pdf/tipos';

/** Linha de organization_custom_fields (espelho do schema) */
export interface OrganizationCustomField {
  id: string;
  organization_id: string;
  field_key: string;
  label: string;
  field_type: TipoCampoPersonalizado;
  value: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const TABELA = 'organization_custom_fields' as const;

function paraCampo(row: Record<string, unknown>): OrganizationCustomField {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    field_key: row.field_key as string,
    label: row.label as string,
    field_type: (row.field_type ?? 'texto') as TipoCampoPersonalizado,
    value: (row.value ?? '') as string,
    is_active: row.is_active as boolean,
    display_order: (row.display_order ?? 0) as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const OrganizationCustomFieldService = {
  /** Lista os campos da org (ordem canónica: display_order, created_at). Lança em erro. */
  async listar(organizationId: string): Promise<OrganizationCustomField[]> {
    const { data, error } = await supabase
      .from(TABELA)
      .select('*')
      .eq('organization_id', organizationId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => paraCampo(r));
  },

  /**
   * Mapa field_key→value dos campos ACTIVOS da org (contrato de
   * consumo dos templates: organization.custom_fields.<key>).
   * NUNCA lança — org sem campos/erro → {} (blocos ocultam-se).
   */
  async obterMapaActivos(organizationId: string | null | undefined): Promise<Record<string, string>> {
    if (!organizationId) return {};
    try {
      const { data, error } = await supabase
        .from(TABELA)
        .select('field_key, value')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (error) return {};
      const mapa: Record<string, string> = {};
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const chave = r.field_key as string;
        const valor = ((r.value ?? '') as string).trim();
        if (chave && valor) mapa[chave] = valor;
      }
      return mapa;
    } catch {
      return {};
    }
  },

  /**
   * Cria um campo na org. Valida no módulo puro ANTES de ir à DB
   * (a DB replica os CHECKs como rede de segurança). Lança em erro.
   */
  async criar(input: {
    organization_id: string;
    field_key: string;
    label: string;
    field_type: TipoCampoPersonalizado;
    value?: string;
    display_order?: number;
  }): Promise<OrganizationCustomField> {
    const validacao = validarCampoPersonalizado({
      field_key: input.field_key,
      field_type: input.field_type,
      value: input.value,
    });
    if (!validacao.ok) throw new Error(validacao.erro);

    const { data, error } = await supabase
      .from(TABELA)
      .insert({
        organization_id: input.organization_id,
        field_key: input.field_key,
        label: input.label.trim() || input.field_key,
        field_type: input.field_type,
        value: (input.value ?? '').trim(),
        is_active: true,
        display_order: input.display_order ?? 0,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new Error(`Já existe um campo com a chave "${input.field_key}" nesta organização`);
      }
      if (error.code === '23514') {
        throw new Error('Chave ou tipo rejeitados pela base de dados (verifique o formato)');
      }
      throw new Error(error.message);
    }
    return paraCampo(data as Record<string, unknown>);
  },

  /**
   * Actualiza label/valor/tipo/ordem de um campo (a field_key é
   * estável por contrato — não se altera para não quebrar
   * referências dos templates). Lança em erro.
   */
  async actualizar(
    campoId: string,
    updates: Partial<{ label: string; value: string; field_type: TipoCampoPersonalizado; display_order: number }>,
  ): Promise<void> {
    if (updates.field_type !== undefined) {
      const tipo = updates.value !== undefined
        ? validarCampoPersonalizado({ field_key: 'x', field_type: updates.field_type, value: updates.value })
        : validarCampoPersonalizado({ field_key: 'x', field_type: updates.field_type, value: '' });
      if (!tipo.ok) throw new Error(tipo.erro);
    } else if (updates.value !== undefined) {
      // sem tipo novo: buscar o actual para validar o valor
      const { data } = await supabase.from(TABELA).select('field_type').eq('id', campoId).maybeSingle();
      const tipoActual = (data?.field_type ?? 'texto') as TipoCampoPersonalizado;
      const r = validarCampoPersonalizado({ field_key: 'x', field_type: tipoActual, value: updates.value });
      if (!r.ok) throw new Error(r.erro);
    }

    const { error } = await supabase.from(TABELA).update(updates).eq('id', campoId);
    if (error) throw new Error(error.message);
  },

  /** Activa/desactiva um campo (desactivado = oculto para os templates). Lança. */
  async definirActivo(campoId: string, is_active: boolean): Promise<void> {
    const { error } = await supabase.from(TABELA).update({ is_active }).eq('id', campoId);
    if (error) throw new Error(error.message);
  },

  /** Remove o campo (definitivo; CASCADE na org). Lança. */
  async remover(campoId: string): Promise<void> {
    const { error } = await supabase.from(TABELA).delete().eq('id', campoId);
    if (error) throw new Error(error.message);
  },
};

/**
 * Anexa os campos personalizados da org ACTIVA do utilizador aos
 * dados do PDF (dados.camposPersonalizados) — camada de mapping
 * consumida pelos templates que precisam de dados além do modelo
 * estruturado (ex.: talaService). Nunca lança; org sem campos ou
 * sem organização devolve os dados inalterados.
 */
export async function anexarCamposPersonalizados(dados: DadosPropostaPdf): Promise<DadosPropostaPdf> {
  const orgId = await OrganizationService.getOrgIdForInsert();
  if (!orgId) return dados;
  const mapa = await OrganizationCustomFieldService.obterMapaActivos(orgId);
  if (Object.keys(mapa).length === 0) return dados;
  return { ...dados, camposPersonalizados: mapa };
}
