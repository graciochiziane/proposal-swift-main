import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/App';
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
  display_name: string;
  profileNome: string | null;
  profileEmail: string;
}

/** Uma membership com dados da organização */
export interface MembershipWithOrg {
  organization_id: string;
  role: OrgRole;
  organization: Organization;
}

interface OrganizationContextValue {
  /** Todas as organizações do utilizador */
  memberships: MembershipWithOrg[];
  /** Organização activa (null se não tiver nenhuma) */
  organization: Organization | null;
  /** Role do utilizador na organização activa */
  role: OrgRole | null;
  /** Lista de membros da organização activa */
  members: OrgMemberWithProfile[];
  /** Se está a carregar os dados da org */
  loading: boolean;
  /** Refrescar dados da organização e membros */
  refresh: () => Promise<void>;
  /** Verificar se o utilizador tem role mínimo (owner > admin > member > viewer) */
  hasRoleMin: (minRole: OrgRole) => boolean;
  /** Se a organização activa tem mais de 1 membro */
  isMultiMember: boolean;
  /** Trocar organização activa */
  setActiveOrganization: (orgId: string) => void;
}

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
};

const ACTIVE_ORG_KEY = 'propostaja_active_org';

function getStoredActiveOrg(userId: string): string | null {
  try {
    return localStorage.getItem(`${ACTIVE_ORG_KEY}_${userId}`);
  } catch (err) {
      console.error("[useOrganization] Error:", err);
    return null;
  }
}

function setStoredActiveOrg(userId: string, orgId: string | null) {
  try {
    if (orgId) {
      localStorage.setItem(`${ACTIVE_ORG_KEY}_${userId}`, orgId);
    } else {
      localStorage.removeItem(`${ACTIVE_ORG_KEY}_${userId}`);
    }
  } catch (err) {
      console.error("[useOrganization] Error:", err);
    // localStorage unavailable
  }
}

export function useOrganization(userId: string | undefined): OrganizationContextValue {
  const [memberships, setMemberships] = useState<MembershipWithOrg[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Derive active org from memberships
  const activeMembership = memberships.find(m => m.organization_id === activeOrgId) ?? memberships[0] ?? null;
  const organization = activeMembership?.organization ?? null;
  const role = activeMembership?.role ?? null;

  const setActiveOrganization = useCallback((orgId: string) => {
    if (userId) setStoredActiveOrg(userId, orgId);
    setActiveOrgIdState(orgId);
    // Clear React Query cache to prevent stale data from previous org
    queryClient.clear();
  }, [userId]);

  const fetchOrgData = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setActiveOrgIdState(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar TODAS as memberships do utilizador
      const { data: allMemberships, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, role, organization:organizations(*)')
        .eq('user_id', userId);

      if (memberError) {
        console.error('Erro ao buscar organizacoes:', memberError);
        setMemberships([]);
        setActiveOrgIdState(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      const ms = (allMemberships || []) as any[];
      const parsed: MembershipWithOrg[] = ms.map((m: any) => ({
        organization_id: m.organization_id,
        role: m.role as OrgRole,
        organization: m.organization as unknown as Organization,
      }));
      setMemberships(parsed);

      // 2. Determinar org activa
      if (parsed.length === 0) {
        setActiveOrgIdState(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      let targetOrgId: string | null = null;

      if (!initialLoadDone.current) {
        // First load: try stored preference, then profile, then first
        const stored = getStoredActiveOrg(userId);
        if (stored && parsed.some(m => m.organization_id === stored)) {
          targetOrgId = stored;
        } else {
          // Fall back to profiles.organization_id (set on signup / first accept)
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', userId)
            .maybeSingle();

          if (profile?.organization_id && parsed.some(m => m.organization_id === profile.organization_id)) {
            targetOrgId = profile.organization_id;
          }
        }
        if (!targetOrgId) {
          targetOrgId = parsed[0].organization_id;
        }
        setActiveOrgIdState(targetOrgId);
        initialLoadDone.current = true;
      } else {
        // Subsequent loads: keep current activeOrgId if still valid
        targetOrgId = activeOrgId && parsed.some(m => m.organization_id === activeOrgId)
          ? activeOrgId
          : parsed[0].organization_id;
      }

      // 3. Buscar membros da org activa
      const { data: memberList, error: listError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', targetOrgId)
        .order('joined_at', { ascending: true });

      if (!listError && memberList) {
        const rawMembers = memberList as any[];
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
            display_name: m.display_name || '',
            profileNome: profileMap.get(m.user_id)?.nome ?? null,
            profileEmail: profileMap.get(m.user_id)?.email ?? '',
          })));
        } else {
          setMembers([]);
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar organizacao:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]); // Intentionally exclude activeOrgId to avoid infinite loops

  useEffect(() => {
    initialLoadDone.current = false;
    fetchOrgData();
  }, [fetchOrgData]);

  // When activeOrgId changes (user switched), reload members
  useEffect(() => {
    if (!initialLoadDone.current || !activeOrgId || !userId) return;

    let cancelled = false;

    (async () => {
      const { data: memberList, error: listError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('joined_at', { ascending: true });

      if (cancelled || listError || !memberList) return;

      const rawMembers = memberList as any[];
      const userIds = rawMembers.map((m: any) => m.user_id);
      if (userIds.length === 0) { setMembers([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', userIds);

      if (cancelled) return;

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
        display_name: m.display_name || '',
        profileNome: profileMap.get(m.user_id)?.nome ?? null,
        profileEmail: profileMap.get(m.user_id)?.email ?? '',
      })));
    })();

    return () => { cancelled = true; };
  }, [activeOrgId, userId]);

  const hasRoleMin = useCallback(
    (minRole: OrgRole): boolean => {
      if (!role) return false;
      return ROLE_HIERARCHY[role] <= ROLE_HIERARCHY[minRole];
    },
    [role]
  );

  return {
    memberships,
    organization,
    role,
    members,
    loading,
    refresh: fetchOrgData,
    hasRoleMin,
    isMultiMember: members.length > 1,
    setActiveOrganization,
  };
}