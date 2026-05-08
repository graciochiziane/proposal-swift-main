import { supabase } from '@/integrations/supabase/client';
import type { CatalogoItem } from '@/types';

export const CatalogService = {
  /**
   * Obtém todos os itens do catálogo do utilizador atual
   */
  async getCatalogo(): Promise<CatalogoItem[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return [];

    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('owner_id', userData.user.id)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar catálogo:', error);
      throw error;
    }

    return data.map(item => ({
      id: item.id,
      nome: item.nome,
      precoUnitario: Number(item.preco_unitario),
    }));
  },

  /**
   * Adiciona ou atualiza um item no catálogo (Upsert atómico por owner_id + nome)
   * Requer UNIQUE constraint: (owner_id, nome) na tabela catalog_items
   */
  async salvarItem(item: Omit<CatalogoItem, 'id'>): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Não autenticado');

    const { error } = await supabase
      .from('catalog_items')
      .upsert({
        owner_id: userData.user.id,
        nome: item.nome,
        preco_unitario: item.precoUnitario,
      }, {
        onConflict: 'owner_id,nome',
      });

    if (error) {
      console.error('Erro ao salvar item do catálogo:', error);
      throw error;
    }
  },

  /**
   * Remove um item do catálogo
   */
  async removerItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('catalog_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover item do catálogo:', error);
      throw error;
    }
  }
};
