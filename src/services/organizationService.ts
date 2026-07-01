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
   * Busca a organizacao do utilizador actual (via membership).
   * Retorna null se o utilizador nao tiver organizacao.
   */
  async getMyOrganization(): Promise<Organization | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id, role, organization:organizations(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar organizacao:', error);
      return null;
    }

    if (!data?.organization_id) return null;

    return data.organization as unknown as Organization;
  },

  /**
   * Actualiza dados da organizacao (nome, logo, cor).
   * Requer role owner ou admin.
   */
  async updateOrganization(updates: {
    nome?: string;
    logo_url?: string | null;
    cor_primaria?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', await this._getMyOrgId());

    if (error) throw error;
  },

  /**
   * Retorna o organization_id do utilizador actual.
   * Retorna null se nao tiver org.
   */
  async _getMyOrgId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    return data?.organization_id ?? null;
  },

  /**
   * Helper para obter organization_id para uso nos inserts.
   * Se o user tem org, retorna o org_id para preencher no insert.
   * Se nao tem org, retorna null (o owner_id sera o filtro).
   */
  async getOrgIdForInsert(): Promise<string | null> {
    return this._getMyOrgId();
  },
};