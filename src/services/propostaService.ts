import { supabase } from '@/integrations/supabase/client';
import { calcularSubtotal, calcularTotal } from '@/lib/calculos';
import type { ItemProposta, DescontoTipo, Proposta, StatusProposta } from '@/types';
import type { Database } from '@/integrations/supabase/types';
import { OrganizationService } from './organizationService';

// ── Supabase type aliases ──
type ProposalRow = Database['public']['Tables']['proposals']['Row'];
type ProposalInsert = Database['public']['Tables']['proposals']['Insert'];
type ProposalItemRow = Database['public']['Tables']['proposal_items']['Row'];
type ProposalItemInsert = Database['public']['Tables']['proposal_items']['Insert'];

// Interface para o resultado do JOIN proposals + clients
// (removida: o select com colunas explícitas + relationships do types.ts
// regenerado já infere o tipo correcto — anotação manual causava TS2345)

// -------------------------------------------
// Utility: formatar valor como MZN
// -------------------------------------------

export function formatCompactMZN(valor: number): string {
  if (valor >= 1_000_000) return (valor / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M MZN";
  if (valor >= 1_000) return (valor / 1_000).toFixed(2).replace(/\.?0+$/, "") + "K MZN";
  return formatMZN(valor);
}
export function formatMZN(value: number): string {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 2,
  }).format(value);
}

// -------------------------------------------
// Tipos de retorno do Service
// -------------------------------------------

/** Proposta resumida para listagem (Dashboard) */
export interface PropostaResumo {
  id: string;
  numero: string;
  clienteId: string;
  clienteNome: string;
  clienteEmpresa: string;
  data: string;
  total: number;
  status: StatusProposta;
  // Observações da proposta — usada pelo filtro de busca em Propostas.tsx
  observacoes?: string;
  created_at: string;
}

/** Proposta completa com items (Resumo, Edição, PDF) */
export interface PropostaCompleta extends Proposta {
  // Já herda tudo do tipo global, incluindo itens e snapshots
}

/** Dados para criar/atualizar proposta (sem itens) */
export interface PropostaInput {
  clienteId: string;
  data: string;
  observacoes: string;
  descontoTipo: DescontoTipo;
  descontoValor: number;
  ivaPercentual: number;
}

// -------------------------------------------
// Service
// -------------------------------------------

interface ClientRelation {
  nome: string;
  empresa: string;
}

export const PropostaService = {

  /**
   * Lista todas as propostas do utilizador actual.
   * Join com clients(nome, empresa) — uma query, sem busca separada.
   */
  async getPropostas(): Promise<PropostaResumo[]> {
    const orgId = await OrganizationService.getOrgIdForInsert();

    let query = supabase
      .from('proposals')
      .select(`
        id,
        numero,
        client_id,
        data,
        total,
        status,
        observacoes,
        created_at,
        created_by,
        clients(nome, empresa)
      `)
      .order('data', { ascending: false });

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar propostas:', error);
      throw error;
    }

    return (data || []).map((p) => {
      const client = p.clients as ClientRelation | null;
      return {
        id: p.id,
        numero: p.numero || '—',
        clienteId: p.client_id,
        clienteNome: client?.nome || 'Cliente removido',
        clienteEmpresa: client?.empresa || '',
        data: p.data,
        total: Number(p.total),
        status: p.status,
        observacoes: p.observacoes ?? '',
        created_at: p.created_at,
      };
    });
  },

  /**
   * Busca uma proposta completa com todos os seus items.
   * Ordena items por 'ordem'.
   */
  async getPropostaById(id: string): Promise<PropostaCompleta | null> {
    const { data, error } = await supabase
      .from('proposals')
      .select(`*, proposal_items(*)`)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar proposta:', error);
      throw error;
    }

    if (!data) return null;

    const dbItems = (data.proposal_items || []) as ProposalItemRow[];
    const items: ItemProposta[] = dbItems
      .sort((a, b) => a.ordem - b.ordem)
      .map((item: ProposalItemRow) => ({
        id: item.id,
        nome: item.nome,
        quantidade: Number(item.quantidade),
        precoUnitario: Number(item.preco_unitario),
        subtotal: Number(item.subtotal),
      }));

    return {
      id: data.id,
      numero: data.numero || '',
      clienteId: data.client_id,
      data: data.data,
      observacoes: data.observacoes || '',
      subtotal: Number(data.subtotal),
      descontoTipo: data.desconto_tipo as DescontoTipo,
      descontoValor: Number(data.desconto_valor),
      ivaPercentual: Number(data.iva_percentual),
      total: Number(data.total),
      status: data.status as Proposta['status'],
      clienteSnapshot: data.cliente_snapshot as Proposta['clienteSnapshot'],
      itens: items,
      created_at: data.created_at,
    } as PropostaCompleta;
  },

  /**
   * Cria uma nova proposta com os seus items.
   */
  async criarProposta(
    input: PropostaInput,
    itens: Omit<ItemProposta, 'id' | 'subtotal'>[]
  ): Promise<PropostaCompleta> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Utilizador não autenticado');

    // 1. Buscar cliente para snapshot
    const { data: cliente } = await supabase
      .from('clients')
      .select('*')
      .eq('id', input.clienteId)
      .single();

    if (!cliente) throw new Error('Cliente não encontrado');

    const clienteSnapshot = {
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      empresa: cliente.empresa || '',
      nuit: cliente.nuit || '',
      endereco: cliente.endereco || '',
    };

    // 2. Calcular totais usando calculos.ts
    const subtotal = calcularSubtotal(
      itens.map(i => ({ ...i, id: '', subtotal: i.quantidade * i.precoUnitario }))
    );
    const totais = calcularTotal(subtotal, input.descontoTipo, input.descontoValor, input.ivaPercentual);

    // 3. Inserir proposta
    const orgId = await OrganizationService.getOrgIdForInsert();

    const { data: proposta, error: propError } = await supabase
      .from('proposals')
      .insert([{
        owner_id: userData.user.id,
        organization_id: orgId,
        created_by: userData.user.id,
        client_id: input.clienteId,
        data: input.data,
        observacoes: input.observacoes || null,
        subtotal: subtotal,
        desconto_tipo: input.descontoTipo,
        desconto_valor: input.descontoValor,
        iva_percentual: input.ivaPercentual,
        total: totais.total,
        cliente_snapshot: clienteSnapshot,
      } as unknown as ProposalInsert])
      // Cast duplo documentado: `numero` não é passado porque é gerado pelo
      // trigger set_proposal_numero() quando NULL (ver migration
      // 20260708010000_multi_tenant_trigger_hardening.sql). O tipo Insert
      // exige numero (coluna NOT NULL sem default) — o gen types não conhece
      // triggers. NÃO passar numero: '' (string vazia é NOT NULL e o trigger
      // preservaria o valor vazio).
      .select()
      .single();

    if (propError) {
      if (propError.message?.includes('limit') || propError.code === '42501') {
        throw new Error(
          'Limite de propostas do seu plano atingido. Actualize o plano para criar mais.'
        );
      }
      console.error('Erro ao criar proposta:', propError);
      throw propError;
    }

    // 4. Inserir items
    if (itens.length > 0) {
      const itemsToInsert = itens.map((item, index) => ({
        proposal_id: proposta.id,
        nome: item.nome,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
        subtotal: item.quantidade * item.precoUnitario,
        ordem: index + 1,
      }));

      const { error: itemsError } = await supabase
        .from('proposal_items')
        .insert(itemsToInsert as ProposalItemInsert[]);

      if (itemsError) {
        console.error('Erro ao inserir items:', itemsError);
        await supabase.from('proposals').delete().eq('id', proposta.id);
        throw itemsError;
      }
    }

    return {
      id: proposta.id,
      numero: proposta.numero || '',
      clienteId: proposta.client_id,
      data: proposta.data,
      observacoes: proposta.observacoes || '',
      subtotal: Number(proposta.subtotal),
      descontoTipo: proposta.desconto_tipo as DescontoTipo,
      descontoValor: Number(proposta.desconto_valor),
      ivaPercentual: Number(proposta.iva_percentual),
      total: Number(proposta.total),
      status: proposta.status as Proposta['status'],
      clienteSnapshot: proposta.cliente_snapshot as Proposta['clienteSnapshot'],
      itens: itens.map(item => ({
        id: '',
        nome: item.nome,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.quantidade * item.precoUnitario,
      })),
      created_at: proposta.created_at,
    };
  },

  /**
   * Atualiza uma proposta existente.
   */
  async atualizarProposta(
    id: string,
    input: PropostaInput,
    itens: Omit<ItemProposta, 'id' | 'subtotal'>[]
  ): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Utilizador não autenticado');

    const subtotal = calcularSubtotal(
      itens.map(i => ({ ...i, id: '', subtotal: i.quantidade * i.precoUnitario }))
    );
    const totais = calcularTotal(subtotal, input.descontoTipo, input.descontoValor, input.ivaPercentual);

    const { error: propError } = await supabase
      .from('proposals')
      .update({
        client_id: input.clienteId,
        data: input.data,
        observacoes: input.observacoes || null,
        subtotal: subtotal,
        desconto_tipo: input.descontoTipo,
        desconto_valor: input.descontoValor,
        iva_percentual: input.ivaPercentual,
        total: totais.total,
      } as Partial<ProposalRow>)
      .eq('id', id);
      // RLS protege a actualizacao — sem filter owner_id
      // (na org, qualquer membro pode editar propostas da org)

    if (propError) {
      console.error('Erro ao atualizar proposta:', propError);
      throw propError;
    }

    // Buscar IDs dos items antigos antes de qualquer alteração
    const { data: oldItems } = await supabase
      .from('proposal_items')
      .select('id')
      .eq('proposal_id', id);
    const oldItemIds = (oldItems || []).map(i => i.id);

    // Inserir novos items primeiro — se falhar, os antigos ficam intactos
    if (itens.length > 0) {
      const itemsToInsert = itens.map((item, index) => ({
        proposal_id: id,
        nome: item.nome,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
        subtotal: item.quantidade * item.precoUnitario,
        ordem: index + 1,
      }));

      const { error: itemsError } = await supabase
        .from('proposal_items')
        .insert(itemsToInsert as ProposalItemInsert[]);

      if (itemsError) {
        console.error('Erro ao atualizar items:', itemsError);
        throw itemsError;
      }
    }

    // Apagar só os items antigos (por ID específico)
    if (oldItemIds.length > 0) {
      await supabase.from('proposal_items').delete().in('id', oldItemIds);
    }
  },

  /**
   * Remove uma proposta.
   */
  async removerProposta(id: string): Promise<void> {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover proposta:', error);
      throw error;
    }
  },

  /**
   * Duplica uma proposta.
   */
  async duplicarProposta(id: string): Promise<PropostaCompleta> {
    const original = await this.getPropostaById(id);
    if (!original) throw new Error('Proposta não encontrada');

    return this.criarProposta(
      {
        clienteId: original.clienteId,
        data: new Date().toISOString().split('T')[0],
        observacoes: original.observacoes,
        descontoTipo: original.descontoTipo,
        descontoValor: original.descontoValor,
        ivaPercentual: original.ivaPercentual,
      },
      original.itens.map(({ id, subtotal, ...rest }) => rest)
    );
  },

  /**
   * Atualiza o status de uma proposta
   */
  async atualizarStatus(id: string, status: 'rascunho' | 'enviada' | 'aceite' | 'rejeitada'): Promise<void> {
    const { error } = await supabase
      .from('proposals')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  },
};
