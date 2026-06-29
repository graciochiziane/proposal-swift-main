import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';

// Re-exportar tipo de role para uso nos componentes
export type OrgRole = Enums['org_role'];
export type Organization = Tables<'organizations'>['Row'];
export type OrgMember = Tables<'organization_members'>['Row'] & {
  profiles?: { id: string; nome: string | null; email: string } | null;
};

interface OrganizationContextValue {
  /** Organização actual do utilizador (null se não tiver) */
  organization: Organization | null;
  /** Role do utilizador na organização */
  role: OrgRole | null;
  /** Lista de membros da organização */
  members: OrgMember[];
  /** Se está a carregar os dados da org */
  loading: boolean;
  /** Refrescar dados da organização e membros */
  refresh: () => Promise<void>;
  /** Verificar se o utilizador tem role mínimo (owner > admin > member > viewer) */
  hasRoleMin: (minRole: OrgRole) => boolean;
  /** Se a organização tem mais de 1 membro */
  isMultiMember: boolean;
}

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
};

export function useOrganization(userId: string | undefined): OrganizationContextValue {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrgData = useCallback(async () => {
    if (!userId) {
      setOrganization(null);
      setRole(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar membership do utilizador
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, role, organization:organizations(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        console.error('Erro ao buscar organização:', memberError);
        setOrganization(null);
        setRole(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      if (!membership?.organization_id) {
        setOrganization(null);
        setRole(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      // 2. Extrair org e role
      const orgData = membership.organization as unknown as Organization;
      setOrganization(orgData);
      setRole(membership.role);

      // 3. Buscar todos os membros com profiles
      const { data: memberList, error: listError } = await supabase
        .from('organization_members')
        .select('*, profiles:id (id, nome, email)')
        .eq('organization_id', membership.organization_id)
        .order('joined_at', { ascending: true });

      if (!listError && memberList) {
        setMembers(memberList as unknown as OrgMember[]);
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar organização:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOrgData();
  }, [fetchOrgData]);

  const hasRoleMin = useCallback(
    (minRole: OrgRole): boolean => {
      if (!role) return false;
      return ROLE_HIERARCHY[role] <= ROLE_HIERARCHY[minRole];
    },
    [role]
  );

  return {
    organization,
    role,
    members,
    loading,
    refresh: fetchOrgData,
    hasRoleMin,
    isMultiMember: members.length > 1,
  };
}