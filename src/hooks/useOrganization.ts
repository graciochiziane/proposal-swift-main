import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';

// Re-exportar tipo de role para uso nos componentes
export type OrgRole = Enums['org_role'];
export type Organization = Tables<'organizations'>['Row'];

// Membro com dados de profile (flat, sem join — FK aponta para auth.users)
export interface OrgMemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  invited_by: string | null;
  profileNome: string | null;
  profileEmail: string;
}

interface OrganizationContextValue {
  /** Organização actual do utilizador (null se não tiver) */
  organization: Organization | null;
  /** Role do utilizador na organização */
  role: OrgRole | null;
  /** Lista de membros da organização */
  members: OrgMemberWithProfile[];
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
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([]);
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
      // O join "organization:organizations(*)" FUNCIONA porque
      // o FK organization_id aponta diretamente para organizations(id).
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, role, organization:organizations(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        console.error('Erro ao buscar organizacao:', memberError);
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

      // 3. Buscar todos os membros (sem join — FK user_id -> auth.users, nao profiles)
      const { data: memberList, error: listError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .order('joined_at', { ascending: true });

      if (!listError && memberList) {
        const rawMembers = memberList as any[];

        // 4. Buscar profiles separadamente
        // RLS profiles_select_org permite ler profiles da mesma org
        const userIds = rawMembers.map((m: any) => m.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, nome, email')
            .in('id', userIds);

          const profileMap = new Map<string, { nome: string | null; email: string }>();
          (profiles || []).forEach((p: any) => {
            profileMap.set(p.id, { nome: p.nome, email: p.email || '' });
          });

          setMembers(rawMembers.map((m: any) => ({
            id: m.id,
            organization_id: m.organization_id,
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            invited_by: m.invited_by,
            profileNome: profileMap.get(m.user_id)?.nome ?? null,
            profileEmail: profileMap.get(m.user_id)?.email ?? '',
          })));
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar organizacao:', err);
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