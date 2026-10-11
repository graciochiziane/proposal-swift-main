import { supabase } from '@/integrations/supabase/client';
import type { OrgRole } from '@/hooks/useOrganization';
import { OrganizationService } from '@/services/organizationService';

// ── Types ──
// Usamos flat fields em vez de join porque o FK user_id aponta para
// auth.users(id), NAO para profiles(id). O join Supabase nao consegue
// resolver "profiles:user_id" quando o FK alvo e auth.users.
export interface MemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  invited_by: string | null;
  display_name: string;
  profileNome: string | null;
  profileEmail: string;
}

// ── Service ──
export const MemberService = {

  /**
   * Lista todos os membros da organizacao do utilizador actual,
   * com dados do profile buscados em query separada.
   */
  async getMembers(): Promise<MemberWithProfile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Buscar org_id activa do user (multi-org: usar a org seleccionada)
    const orgId = await OrganizationService._getMyOrgId();
    if (!orgId) return [];

    // 2. Buscar todos os membros da org activa (sem join)
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar membros:', error);
      throw error;
    }

    const members = (data || []) as any[];
    if (members.length === 0) return [];

    // 3. Buscar profiles separadamente
    // RLS profiles_select_org permite ler profiles da mesma org
    const userIds = members.map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .in('id', userIds);

    const profileMap = new Map<string, { nome: string | null; email: string }>();
    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, { nome: p.nome, email: p.email || '' });
    });

    // 4. Merge membros com profiles
    return members.map((m: any) => ({
      id: m.id,
      organization_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      invited_by: m.invited_by,
      display_name: m.display_name || '',
      profileNome: profileMap.get(m.user_id)?.nome ?? null,
      profileEmail: profileMap.get(m.user_id)?.email ?? '',
    }));
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
   * Actualiza o display_name de um membro.
   * Requer owner ou admin.
   */
  async updateDisplayName(memberId: string, displayName: string): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .update({ display_name: displayName.trim() })
      .eq('id', memberId);

    if (error) throw error;
  },

  /**
   * Conta membros da organizacao do utilizador.
   */
  async countMembers(): Promise<number> {
    const orgId = await OrganizationService._getMyOrgId();
    if (!orgId) return 0;

    const { count, error } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (error) return 0;
    return count ?? 0;
  },

  /**
   * Transfere ownership de um membro para outro.
   * O owner actual passa a admin.
   * Usa RPC atomico — sem race condition entre os dois UPDATEs.
   */
  async transferOwnership(targetMemberId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    const { error } = await supabase.rpc('transfer_ownership', {
      p_current_owner_id: user.id,
      p_target_member_id: targetMemberId,
    });

    if (error) throw new Error(error.message || 'Erro ao transferir ownership');
  },
};