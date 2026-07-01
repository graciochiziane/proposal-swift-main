import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';
import type { OrgRole, OrgMember } from '@/hooks/useOrganization';

// ── Types ──
export interface MemberWithProfile extends OrgMember {
  profiles: { id: string; nome: string | null; email: string } | null;
}

// ── Service ──
export const MemberService = {

  /**
   * Lista todos os membros da organizacao do utilizador actual,
   * com dados do profile.
   */
  async getMembers(): Promise<MemberWithProfile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Buscar org_id do user
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership?.organization_id) return [];

    // 2. Buscar todos os membros com profiles
    const { data, error } = await supabase
      .from('organization_members')
      .select('*, profiles:user_id (id, nome, email)')
      .eq('organization_id', membership.organization_id)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar membros:', error);
      throw error;
    }

    return (data || []) as unknown as MemberWithProfile[];
  },

  /**
   * Altera o role de um membro. Requer owner ou admin.
   * Nao e possivel alterar o proprio role.
   */
  async changeRole(memberId: string, newRole: OrgRole): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    // Impedir auto-promocao/democao
    const { data: target } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('id', memberId)
      .single();

    if (target?.user_id === user.id) {
      throw new Error('Nao pode alterar o seu proprio role');
    }

    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) throw error;
  },

  /**
   * Remove um membro da organizacao.
   * Nao e possivel remover o owner (transferir primeiro).
   */
  async removeMember(memberId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    // Verificar se o membro e owner
    const { data: target } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .single();

    if (!target) throw new Error('Membro nao encontrado');
    if (target.role === 'owner') {
      throw new Error('Nao e possivel remover o owner. Transfira a propriedade primeiro.');
    }
    if (target.user_id === user.id) {
      throw new Error('Nao pode remover-se a si mesmo da organizacao.');
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  },

  /**
   * Conta membros da organizacao do utilizador.
   */
  async countMembers(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership?.organization_id) return 0;

    const { count, error } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id);

    if (error) return 0;
    return count ?? 0;
  },
};