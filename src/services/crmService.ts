// ============================================================
// CRM Service — Business CRM operations
//
// All methods require crm_access feature (Business plan).
// RLS enforces multi-tenant isolation at the database level.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { OrganizationService } from './organizationService';
import type { Cliente } from '@/types';

// ---- Types ----

export type CrmEstado =
  | 'novo' | 'contactado' | 'qualificado' | 'proposta_enviada'
  | 'em_negociacao' | 'ganho' | 'perdido' | 'inactivo';

export type CrmOrigem =
  | 'whatsapp' | 'facebook' | 'instagram' | 'website'
  | 'referencia' | 'cliente_existente' | 'outro';

export type CrmActivityType =
  | 'contacto' | 'chamada' | 'whatsapp' | 'email' | 'reuniao'
  | 'nota' | 'proposta_enviada' | 'follow_up' | 'outro';

export interface CrmActivity {
  id: string;
  client_id: string;
  proposal_id: string | null;
  type: CrmActivityType;
  title: string;
  description: string;
  performed_by: string;
  performed_at: string;
  created_at: string;
}

export interface CrmFollowUp {
  id: string;
  client_id: string;
  proposal_id: string | null;
  title: string;
  description: string;
  due_at: string;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
}

export interface CrmTag {
  id: string;
  name: string;
  color: string;
}

export interface ClienteWithCRM extends Cliente {
  cargo: string;
  whatsapp: string;
  origem: CrmOrigem | null;
  tipo: string;
  estado_comercial: CrmEstado;
  valor_potencial: number;
  ultimo_contacto: string | null;
  proximo_contacto: string | null;
  responsavel_id: string | null;
  notas: string;
  tags?: CrmTag[];
  proposta_count?: number;
  proposta_valor_total?: number;
}

export interface PipelineOpportunity {
  client_id: string;
  nome: string;
  empresa: string;
  estado_comercial: CrmEstado;
  valor_potencial: number;
  ultimo_contacto: string | null;
  proximo_contacto: string | null;
  proposta_count: number;
}

export interface CRMInsights {
  total_clientes: number;
  leads_ativos: number;
  negocios_abertos: number;
  valor_pipeline: number;
  propostas_pendentes: number;
  followups_pendentes: number;
  taxa_conversao: number;
}

// ---- Helper ----

async function getOrgId(): Promise<string | null> {
  return await OrganizationService.getOrgIdForInsert();
}

// ---- Activities ----

export const CrmService = {

  // === Activities ===

  async getActivitiesByClient(clientId: string): Promise<CrmActivity[]> {
    const { data, error } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CrmActivity[];
  },

  async getRecentActivities(limit = 20): Promise<CrmActivity[]> {
    const { data, error } = await supabase
      .from('crm_activities')
      .select('*, clients!inner(nome, empresa)')
      .order('performed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CrmActivity[];
  },

  async createActivity(input: {
    client_id: string;
    proposal_id?: string | null;
    type: CrmActivityType;
    title: string;
    description?: string;
    performed_at?: string;
  }): Promise<CrmActivity> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Não autenticado');

    const orgId = await getOrgId();
    if (!orgId) throw new Error('Nenhuma organização seleccionada');

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        organization_id: orgId,
        client_id: input.client_id,
        proposal_id: input.proposal_id ?? null,
        type: input.type,
        title: input.title,
        description: input.description ?? '',
        performed_by: userData.user.id,
        performed_at: input.performed_at ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    // Update client's ultimo_contacto
    await supabase
      .from('clients')
      .update({ ultimo_contacto: input.performed_at ?? new Date().toISOString() })
      .eq('id', input.client_id);

    return data as CrmActivity;
  },

  async deleteActivity(id: string): Promise<void> {
    const { error } = await supabase.from('crm_activities').delete().eq('id', id);
    if (error) throw error;
  },

  // === Follow-ups ===

  async getFollowUps(filter?: 'overdue' | 'today' | 'upcoming' | 'all'): Promise<CrmFollowUp[]> {
    let query = supabase
      .from('crm_follow_ups')
      .select('*, clients!inner(nome, empresa)')
      .order('due_at', { ascending: true });

    if (filter === 'overdue') {
      query = query.lt('due_at', new Date().toISOString()).is('completed_at', null);
    } else if (filter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('due_at', startOfDay.toISOString())
                   .lte('due_at', endOfDay.toISOString())
                   .is('completed_at', null);
    } else if (filter === 'upcoming') {
      query = query.gte('due_at', new Date().toISOString()).is('completed_at', null);
    } else if (filter === 'all') {
      query = query.is('completed_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CrmFollowUp[];
  },

  async getFollowUpsByClient(clientId: string): Promise<CrmFollowUp[]> {
    const { data, error } = await supabase
      .from('crm_follow_ups')
      .select('*')
      .eq('client_id', clientId)
      .order('due_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as CrmFollowUp[];
  },

  async createFollowUp(input: {
    client_id: string;
    proposal_id?: string | null;
    title: string;
    description?: string;
    due_at: string;
  }): Promise<CrmFollowUp> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Não autenticado');

    const orgId = await getOrgId();
    if (!orgId) throw new Error('Nenhuma organização seleccionada');

    const { data, error } = await supabase
      .from('crm_follow_ups')
      .insert({
        organization_id: orgId,
        client_id: input.client_id,
        proposal_id: input.proposal_id ?? null,
        title: input.title,
        description: input.description ?? '',
        due_at: input.due_at,
        created_by: userData.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    // Update client's proximo_contacto
    await supabase
      .from('clients')
      .update({ proximo_contacto: input.due_at })
      .eq('id', input.client_id);

    return data as CrmFollowUp;
  },

  async completeFollowUp(id: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Não autenticado');

    const { error } = await supabase
      .from('crm_follow_ups')
      .update({
        completed_at: new Date().toISOString(),
        completed_by: userData.user.id,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteFollowUp(id: string): Promise<void> {
    const { error } = await supabase.from('crm_follow_ups').delete().eq('id', id);
    if (error) throw error;
  },

  // === Tags ===

  async getTags(): Promise<CrmTag[]> {
    const { data, error } = await supabase
      .from('crm_tags')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data ?? []) as CrmTag[];
  },

  async createTag(name: string, color = '#6366f1'): Promise<CrmTag> {
    const orgId = await getOrgId();
    if (!orgId) throw new Error('Nenhuma organização seleccionada');

    const { data, error } = await supabase
      .from('crm_tags')
      .insert({ organization_id: orgId, name, color })
      .select()
      .single();
    if (error) throw error;
    return data as CrmTag;
  },

  async deleteTag(id: string): Promise<void> {
    const { error } = await supabase.from('crm_tags').delete().eq('id', id);
    if (error) throw error;
  },

  async setClientTags(clientId: string, tagIds: string[]): Promise<void> {
    // Remove existing tags
    await supabase.from('crm_contact_tags').delete().eq('client_id', clientId);
    // Insert new tags
    if (tagIds.length > 0) {
      const rows = tagIds.map(tag_id => ({ client_id: clientId, tag_id }));
      const { error } = await supabase.from('crm_contact_tags').insert(rows);
      if (error) throw error;
    }
  },

  // === Clients with CRM data ===

  async getClientesCRM(filters?: {
    estado?: CrmEstado;
    origem?: CrmOrigem;
    search?: string;
  }): Promise<ClienteWithCRM[]> {
    let query = supabase
      .from('clients')
      .select(`
        *,
        crm_contact_tags(tag_id, crm_tags(id, name, color))
      `)
      .order('created_at', { ascending: false });

    if (filters?.estado) {
      query = query.eq('estado_comercial', filters.estado);
    }
    if (filters?.origem) {
      query = query.eq('origem', filters.origem);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      query = query.or(`nome.ilike.%${q}%,empresa.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((c: any) => ({
      id: c.id,
      nome: c.nome,
      email: c.email || '',
      telefone: c.telefone || '',
      empresa: c.empresa || '',
      nuit: c.nuit || '',
      endereco: c.endereco || '',
      cargo: c.cargo || '',
      whatsapp: c.whatsapp || '',
      origem: c.origem,
      tipo: c.tipo || 'contacto',
      estado_comercial: c.estado_comercial || 'novo',
      valor_potencial: Number(c.valor_potencial) || 0,
      ultimo_contacto: c.ultimo_contacto,
      proximo_contacto: c.proximo_contacto,
      responsavel_id: c.responsavel_id,
      notas: c.notas || '',
      tags: (c.crm_contact_tags ?? []).map((ct: any) => ct.crm_tags).filter(Boolean),
    }));
  },

  async getClienteWithRelations(clientId: string): Promise<{
    cliente: ClienteWithCRM | null;
    propostas: Array<{
      id: string; numero: string; total: number; status: string;
      data: string; created_at: string;
    }>;
    activities: CrmActivity[];
    followUps: CrmFollowUp[];
  }> {
    // Load cliente with tags
    const { data: clienteData } = await supabase
      .from('clients')
      .select(`
        *,
        crm_contact_tags(tag_id, crm_tags(id, name, color))
      `)
      .eq('id', clientId)
      .maybeSingle();

    if (!clienteData) {
      return { cliente: null, propostas: [], activities: [], followUps: [] };
    }

    const c: any = clienteData;
    const cliente: ClienteWithCRM = {
      id: c.id, nome: c.nome, email: c.email || '', telefone: c.telefone || '',
      empresa: c.empresa || '', nuit: c.nuit || '', endereco: c.endereco || '',
      cargo: c.cargo || '', whatsapp: c.whatsapp || '', origem: c.origem,
      tipo: c.tipo || 'contacto', estado_comercial: c.estado_comercial || 'novo',
      valor_potencial: Number(c.valor_potencial) || 0,
      ultimo_contacto: c.ultimo_contacto, proximo_contacto: c.proximo_contacto,
      responsavel_id: c.responsavel_id, notas: c.notas || '',
      tags: (c.crm_contact_tags ?? []).map((ct: any) => ct.crm_tags).filter(Boolean),
    };

    // Load propostas
    const { data: propostasData } = await supabase
      .from('proposals')
      .select('id, numero, total, status, data, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    // Load activities
    const { data: activitiesData } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false });

    // Load follow-ups
    const { data: followUpsData } = await supabase
      .from('crm_follow_ups')
      .select('*')
      .eq('client_id', clientId)
      .order('due_at', { ascending: true });

    return {
      cliente,
      propostas: propostasData ?? [],
      // description é nullable na BD mas string no tipo de domínio —
      // mapeamos na fronteira (null -> '') sem alterar consumidores
      activities: (activitiesData ?? []).map(a => ({ ...a, description: a.description ?? '' })),
      followUps: (followUpsData ?? []).map(f => ({ ...f, description: f.description ?? '' })),
    };
  },

  async updateClienteCRM(clientId: string, fields: Partial<ClienteWithCRM>): Promise<void> {
    // Objecto tipado (não Record<string, unknown>): o .update() do supabase
    // rejeita index signatures (RejectExcessProperties). Assignments
    // explícitos garantem que só colunas reais são actualizadas.
    const updateData: TablesUpdate<'clients'> = {};
    if (fields.cargo !== undefined) updateData.cargo = fields.cargo;
    if (fields.whatsapp !== undefined) updateData.whatsapp = fields.whatsapp;
    if (fields.origem !== undefined) updateData.origem = fields.origem;
    if (fields.tipo !== undefined) updateData.tipo = fields.tipo;
    if (fields.estado_comercial !== undefined) updateData.estado_comercial = fields.estado_comercial;
    if (fields.valor_potencial !== undefined) updateData.valor_potencial = fields.valor_potencial;
    if (fields.ultimo_contacto !== undefined) updateData.ultimo_contacto = fields.ultimo_contacto;
    if (fields.proximo_contacto !== undefined) updateData.proximo_contacto = fields.proximo_contacto;
    if (fields.responsavel_id !== undefined) updateData.responsavel_id = fields.responsavel_id;
    if (fields.notas !== undefined) updateData.notas = fields.notas;
    if (Object.keys(updateData).length === 0) return;

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId);
    if (error) throw error;
  },

  // === Pipeline ===

  async getPipeline(): Promise<PipelineOpportunity[]> {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, nome, empresa, estado_comercial, valor_potencial,
        ultimo_contacto, proximo_contacto,
        proposals(id)
      `)
      .in('estado_comercial', [
        'novo', 'contactado', 'qualificado', 'proposta_enviada', 'em_negociacao',
        'ganho', 'perdido'
      ])
      .order('estado_comercial', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((c: any) => ({
      client_id: c.id,
      nome: c.nome,
      empresa: c.empresa || '',
      estado_comercial: c.estado_comercial,
      valor_potencial: Number(c.valor_potencial) || 0,
      ultimo_contacto: c.ultimo_contacto,
      proximo_contacto: c.proximo_contacto,
      proposta_count: c.proposals?.length ?? 0,
    }));
  },

  // === Dashboard / Insights ===

  async getInsights(): Promise<CRMInsights> {
    const orgId = await getOrgId();
    if (!orgId) {
      return {
        total_clientes: 0, leads_ativos: 0, negocios_abertos: 0,
        valor_pipeline: 0, propostas_pendentes: 0, followups_pendentes: 0,
        taxa_conversao: 0,
      };
    }

    // Total clientes
    const { count: totalClientes } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    // Leads ativos (não ganho/perdido/inactivo)
    const { count: leadsAtivos } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('estado_comercial', ['novo', 'contactado', 'qualificado', 'proposta_enviada', 'em_negociacao']);

    // Negócios abertos + valor pipeline
    const { data: openDeals } = await supabase
      .from('clients')
      .select('valor_potencial')
      .eq('organization_id', orgId)
      .in('estado_comercial', ['proposta_enviada', 'em_negociacao']);

    const valorPipeline = (openDeals ?? []).reduce((sum, c) => sum + Number(c.valor_potencial || 0), 0);

    // Propostas pendentes (enviadas mas sem decisão)
    const { count: propostasPendentes } = await supabase
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'enviada');

    // Follow-ups pendentes
    const { count: followupsPendentes } = await supabase
      .from('crm_follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('completed_at', null)
      .lt('due_at', new Date().toISOString());

    // Taxa de conversão
    const { count: ganhos } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('estado_comercial', 'ganho');

    const { count: perdidos } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('estado_comercial', 'perdido');

    const totalClosed = (ganhos ?? 0) + (perdidos ?? 0);
    const taxaConversao = totalClosed > 0 ? ((ganhos ?? 0) / totalClosed) * 100 : 0;

    return {
      total_clientes: totalClientes ?? 0,
      leads_ativos: leadsAtivos ?? 0,
      negocios_abertos: (openDeals ?? []).length,
      valor_pipeline: valorPipeline,
      propostas_pendentes: propostasPendentes ?? 0,
      followups_pendentes: followupsPendentes ?? 0,
      taxa_conversao: Math.round(taxaConversao * 100) / 100,
    };
  },
};
