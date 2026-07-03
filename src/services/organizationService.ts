import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';

// ── Types ──
type Organization = Tables<'organizations'>['Row'];
type OrganizationUpdate = Tables<'organizations'>['Update'];

export interface OrgWithStats extends Organization {
  member_count: number;
  proposal_count: number;
}

// ── Service ──
export const OrganizationService = {

  /**
   * Busca todas as organizações do utilizador actual (via memberships).
   * Retorna array vazio se não tiver nenhuma.
   */
  async getMyOrganizations(): Promise<Organization[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization:organizations(*)')
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao buscar organizacoes:', error);
      return [];
    }

    return ((data || []) as any[]).map((m: any) => m.organization as unknown as Organization);
  },

  /**
   * Actualiza dados da organização (nome, logo, cor).
   * Requer role owner ou admin.
   * @param orgId ID da organização a actualizar (se null, usa a activa do contexto)
   */
  async updateOrganization(
    updates: {
      nome?: string;
      logo_url?: string | null;
      cor_primaria?: string;
    },
    orgId?: string | null
  ): Promise<void> {
    const resolvedOrgId = orgId ?? await this._getMyOrgId();
    if (!resolvedOrgId) throw new Error('Nenhuma organizacao seleccionada');

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', resolvedOrgId);

    if (error) throw error;
  },

  /**
   * Retorna o organization_id da org activa do utilizador.
   * Tenta: localStorage -> profiles.organization_id -> primeira membership.
   * Retorna null se nao tiver org.
   */
  async _getMyOrgId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Check localStorage for active org
    const stored = this._getStoredActiveOrg(user.id);
    if (stored) {
      // Verify user is still a member
      const { data: check } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', stored)
        .maybeSingle();
      if (check) return stored;
    }

    // 2. Fall back to profiles.organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.organization_id) {
      const { data: check } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      if (check) return profile.organization_id;
    }

    // 3. First membership
    const { data: firstMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    return firstMember?.organization_id ?? null;
  },

  /**
   * Helper para obter organization_id para uso nos inserts.
   * Usa a org activa do utilizador.
   */
  async getOrgIdForInsert(): Promise<string | null> {
    return this._getMyOrgId();
  },

  // --- private helpers ---
  _getStoredActiveOrg(userId: string): string | null {
    try {
      return localStorage.getItem(`propostaja_active_org_${userId}`);
    } catch {
      return null;
    }
  },
};