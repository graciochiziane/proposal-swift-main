import { supabase } from '@/integrations/supabase/client';
import type { Cliente } from '@/types';

export const ClienteService = {
  /**
   * Obtém todos os clientes do utilizador atual
   */
  async getClientes(): Promise<Cliente[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return [];

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('owner_id', userData.user.id)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      throw error;
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      nome: c.nome,
      email: c.email || '',
      telefone: c.telefone || '',
      empresa: c.empresa || '',
      nuit: c.nuit || '',
      endereco: c.endereco || '',
    }));
  },

  /**
   * Adiciona um novo cliente
   */
  async criarCliente(cliente: Omit<Cliente, 'id'>): Promise<Cliente> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Utilizador não autenticado');

    const { data, error } = await supabase
      .from('clients')
      .insert([{
        owner_id: userData.user.id,
        nome: cliente.nome,
        email: cliente.email || null,
        telefone: cliente.telefone || null,
        empresa: cliente.empresa || null,
        nuit: cliente.nuit || null,
        endereco: cliente.endereco || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      throw error;
    }

    if (!data) throw new Error('Falha ao obter dados do cliente criado');

    return {
      id: data.id,
      nome: data.nome,
      email: data.email || '',
      telefone: data.telefone || '',
      empresa: data.empresa || '',
      nuit: data.nuit || '',
      endereco: data.endereco || '',
    };
  },

  /**
   * Atualiza um cliente existente
   */
  async atualizarCliente(id: string, cliente: Partial<Cliente>): Promise<void> {
    const updateData: any = {};
    if (cliente.nome !== undefined) updateData.nome = cliente.nome;
    if (cliente.email !== undefined) updateData.email = cliente.email || null;
    if (cliente.telefone !== undefined) updateData.telefone = cliente.telefone || null;
    if (cliente.empresa !== undefined) updateData.empresa = cliente.empresa || null;
    if (cliente.nuit !== undefined) updateData.nuit = cliente.nuit || null;
    if (cliente.endereco !== undefined) updateData.endereco = cliente.endereco || null;

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  },

  /**
   * Remove um cliente
   */
  async removerCliente(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover cliente:', error);
      throw error;
    }
  }
};
