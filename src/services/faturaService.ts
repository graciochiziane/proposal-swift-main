import { supabase } from '@/integrations/supabase/client';
import type { Fatura, ItemFatura, StatusFatura } from '@/types';

// ===== HELPERS =====

function formatMZN(valor: number): string {
  return valor.toLocaleString('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 2,
  });
}

// ===== CONVERTER PROPOSTA EM FACTURA =====

export async function converterPropostaEmFactura(
  propostaId: string,
  dataVencimento: string
): Promise<Fatura> {
  // 1. Buscar proposta com items
  const { data: proposta, error: propError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', propostaId)
    .single();

  if (propError) throw new Error('Proposta não encontrada: ' + propError.message);
  if (proposta.status !== 'aceite') {
    throw new Error('Apenas propostas aceite podem ser convertidas em factura.');
  }

  // 2. Buscar items da proposta
  const { data: propItems, error: itemsError } = await supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_id', propostaId)
    .order('ordem', { ascending: true });

  if (itemsError) throw new Error('Erro ao buscar itens: ' + itemsError.message);

  // 3. Criar factura (numero é gerado pelo trigger/DB se configurado, caso contrário via app)
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      owner_id: proposta.owner_id,
      proposal_id: proposta.id,
      client_id: proposta.client_id,
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: dataVencimento,
      total: proposta.total,
    })
    .select()
    .single();

  if (invError) {
    throw new Error('Erro ao criar factura: ' + invError.message);
  }

  // 4. Copiar items da proposta para a factura
  if (propItems && propItems.length > 0) {
    const invoiceItems = propItems.map((item: InvoiceItemRow) => ({
      invoice_id: invoice.id,
      nome: item.nome,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.subtotal,
      ordem: item.ordem,
    }));

    const { error: insError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (insError) {
      // Rollback: apagar factura criada
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw new Error('Erro ao copiar itens: ' + insError.message);
    }
  }

  // 5. Retornar factura completa
  return getFaturaById(invoice.id) as Promise<Fatura>;
}

// ===== LISTAR FATURAS DO USER =====

export async function getFaturas(): Promise<Fatura[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao buscar facturas: ' + error.message);
  return (data as Fatura[]) ?? [];
}

// ===== BUSCAR FATURA POR ID (COM ITEMS) =====

export async function getFaturaById(id: string): Promise<Fatura> {
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (invError) throw new Error('Factura não encontrada: ' + invError.message);

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('ordem', { ascending: true });

  if (itemsError) throw new Error('Erro ao buscar itens: ' + itemsError.message);

  return { ...invoice, items: (items as ItemFatura[]) ?? [] } as Fatura;
}

// ===== FACTURAS POR PROPOSTA =====

export async function getFaturasPorProposta(propostaId: string): Promise<Fatura[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('proposal_id', propostaId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao buscar facturas: ' + error.message);
  return (data as Fatura[]) ?? [];
}

// ===== ACTUALIZAR STATUS DA FACTURA =====

export async function atualizarStatusFatura(
  faturaId: string,
  status: StatusFatura
): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', faturaId);

  if (error) throw new Error('Erro ao actualizar status: ' + error.message);
}

export { formatMZN as formatMZNFatura };
