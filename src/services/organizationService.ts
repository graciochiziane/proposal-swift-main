import { supabase } from '@/integrations/supabase/client';
import type { Tables, Json } from '@/integrations/supabase/types';
import type { DonoProposta } from '@/types';

// ── Types ──
// Nota: no types.ts regenerado (M4), Tables<'X'> devolve directamente o tipo Row.
type Organization = Tables<'organizations'>;

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
   * Actualiza dados da organização (nome, logo, cor, dados fiscais,
   * métodos de pagamento).
   * Requer role owner ou admin (RLS org_update_owner_admin).
   * @param orgId ID da organização a actualizar (se null, usa a activa do contexto)
   */
  async updateOrganization(
    updates: {
      nome?: string;
      logo_url?: string | null;
      cor_primaria?: string;
      nuit?: string | null;
      endereco?: string | null;
      dados_bancarios?: DonoProposta['dadosBancarios'];
      mobile_money?: DonoProposta['mobileMoney'];
      pagamentos_extras?: DonoProposta['pagamentosExtras'];
    },
    orgId?: string | null
  ): Promise<void> {
    const resolvedOrgId = orgId ?? await this._getMyOrgId();
    if (!resolvedOrgId) throw new Error('Nenhuma organizacao seleccionada');

    const { error } = await supabase
      .from('organizations')
      .update({
        nome: updates.nome,
        logo_url: updates.logo_url,
        cor_primaria: updates.cor_primaria,
        nuit: updates.nuit,
        endereco: updates.endereco,
        // Cast documentado: fronteira domínio (tipado) -> Json da coluna
        dados_bancarios: updates.dados_bancarios as Json | undefined,
        mobile_money: updates.mobile_money as unknown as Json | undefined,
        pagamentos_extras: updates.pagamentos_extras as unknown as Json | undefined,
      })
      .eq('id', resolvedOrgId);

    if (error) throw error;
  },

  /**
   * Gera signed URL para o logo da organização.
   * formats aceites em organizations.logo_url:
   *   - http(s)://... → usado como-is
   *   - {org_id}/{filename} → path completo do bucket 'logos'
   *   - {filename}      → prefixa com o org_id
   * Retorna '' quando não há logo ou a assinatura falha.
   */
  async signOrgLogoUrl(logoUrl: string | null | undefined, orgId: string): Promise<string> {
    if (!logoUrl) return '';
    if (logoUrl.startsWith('http')) return logoUrl;

    const path = logoUrl.includes('/') ? logoUrl : `${orgId}/${logoUrl}`;
    const { data: signed, error } = await supabase.storage
      .from('logos')
      .createSignedUrl(path, 3600);

    if (error || !signed) {
      console.warn('Falha ao gerar signed URL para logo da org:', error);
      return '';
    }
    return signed.signedUrl;
  },

  /**
   * Faz upload do logótipo da ORGANIZAÇÃO para logos/{orgId}/…
   * (storage RLS org-aware: admin+ pode escrever, membros leem).
   * Remove apenas o ficheiro anterior SE pertencer à pasta da org —
   * logos legacy ({user_id}/…) nunca são apagados (podem ainda estar
   * referenciados pelo perfil pessoal como fallback).
   * Devolve o path completo para gravar em organizations.logo_url.
   */
  async uploadOrgLogo(file: File, orgId: string): Promise<string> {
    // 1. Buscar logo actual da org
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', orgId)
      .single();

    const previous = org?.logo_url;
    if (previous && previous.includes('/') && previous.startsWith(`${orgId}/`)) {
      await supabase.storage.from('logos').remove([previous]);
      // Ignorar erro — ficheiro pode já não existir
    }

    // 2. Upload do novo ficheiro na pasta da org
    const fileExt = file.name.split('.').pop();
    const filePath = `${orgId}/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    return filePath;
  },

  /**
   * Remove o logótipo da organização (ficheiro + referência).
   * Só apaga ficheiros na pasta da própria org (legado pessoal intacto).
   */
  async removeOrgLogo(orgId: string): Promise<void> {
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', orgId)
      .single();

    const current = org?.logo_url;
    if (current && current.includes('/') && current.startsWith(`${orgId}/`)) {
      await supabase.storage.from('logos').remove([current]);
      // Ignorar erro — ficheiro pode já não existir
    }

    const { error } = await supabase
      .from('organizations')
      .update({ logo_url: null })
      .eq('id', orgId);

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
    } catch (err) {
      console.error("[organizationService] Error:", err);
      return null;
    }
  },
};