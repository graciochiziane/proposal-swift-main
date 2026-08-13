// ============================================================
// Admin Service — Fase 4 SuperAdmin Panel
//
// P1-H5 (2026-08-13): Added requireAdmin() check in all functions.
//   Previously relied 100% on RLS. Now verifies client-side that
//   the caller is authenticated AND has platform admin role.
//   Defense in depth: even if RLS has a gap, this layer catches it.
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type { Tenant, TenantDetail, TenantMember, AuditLogEntry, UpdateTenantData } from '@/types/admin';

// ---- Helpers ----

/**
 * Verifies that the current user is authenticated and has platform admin role.
 * Throws if not. Used as defense-in-depth alongside RLS.
 *
 * Uses getSession() (synchronous, reads from localStorage) instead of
 * getUser() (which makes a network call). The JWT is still validated by
 * RLS when queries reach the database.
 */
async function requireAdmin(): Promise<{ userId: string }> {
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session?.user) {
    throw new Error('Não autenticado');
  }

  const user = session.user;

  const { data: roleRow, error: roleErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleErr) {
    throw new Error(`Erro ao verificar role: ${roleErr.message}`);
  }

  if (roleRow?.role !== 'admin') {
    throw new Error('Acesso negado: apenas admins de plataforma');
  }

  return { userId: user.id };
}

const logAction = async (action: string, targetTable?: string, targetId?: string, targetOwnerId?: string, snapshot?: Record<string, unknown>) => {
  const { userId } = await requireAdmin();
  await supabase.from('admin_audit_log').insert({
    admin_id: userId,
    action,
    target_table: targetTable,
    target_id: targetId,
    target_owner_id: targetOwnerId,
    target_snapshot: snapshot ?? {},
  });
};

// ---- Tenants ----
export const listTenants = async (): Promise<Tenant[]> => {
  await requireAdmin();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tenant[];
};

export const getTenant = async (id: string): Promise<TenantDetail | null> => {
  await requireAdmin();
  const { data: org } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (!org) return null;

  const { count } = await supabase
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', id);

  const { data: score } = await supabase.rpc('organization_health_score', { p_org_id: id });

  return {
    ...(org as Tenant),
    member_count: count ?? 0,
    health_score: score ?? 0,
  };
};

export const getTenantMembers = async (orgId: string): Promise<TenantMember[]> => {
  await requireAdmin();
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, organization_id, role, joined_at, invited_by, profiles!inner(nome, email, last_seen_at)')
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TenantMember[];
};

export const toggleSuspend = async (orgId: string, suspend: boolean, reason = '') => {
  await requireAdmin();
  const { error } = await supabase.rpc('admin_toggle_suspend', {
    p_org_id: orgId,
    p_suspend: suspend,
    p_reason: reason,
  });
  if (error) throw error;
  await logAction(suspend ? 'tenant_suspend' : 'tenant_reactivate', 'organizations', orgId);
};

export const updateTenant = async (id: string, data: UpdateTenantData, previousPlano?: string) => {
  await requireAdmin();
  const { error } = await supabase.from('organizations').update(data).eq('id', id);
  if (error) throw error;
  if (data.plano && previousPlano && data.plano !== previousPlano) {
    await logAction('plan_change', 'organizations', id, undefined, { from: previousPlano, to: data.plano });
  } else {
    await logAction('tenant_update', 'organizations', id, undefined, data as unknown as Record<string, unknown>);
  }
};

// ---- Remove Member ----
export const removeMember = async (memberId: string, orgId: string) => {
  await requireAdmin();
  const { error } = await supabase.rpc('admin_remove_member', {
    p_member_id: memberId,
    p_org_id: orgId,
  });
  if (error) throw error;
  await logAction('member_remove', 'organization_members', orgId, undefined, { member_id: memberId });
};

// ---- Proposal Counts by Period ----
export const getProposalCounts = async (orgId: string): Promise<{ d30: number; d60: number; d90: number }> => {
  await requireAdmin();
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

  const [r30, r60, r90] = await Promise.all([
    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', d30),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', d60),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', d90),
  ]);

  return { d30: r30.count ?? 0, d60: r60.count ?? 0, d90: r90.count ?? 0 };
};

// ---- Audit Log ----
export const getAuditLog = async (filters?: { action?: string; dateFrom?: string; dateTo?: string; targetId?: string }): Promise<AuditLogEntry[]> => {
  await requireAdmin();
  let q = supabase
    .from('admin_audit_log')
    .select('*, profiles!inner(email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters?.action) q = q.eq('action', filters.action);
  if (filters?.targetId) q = q.eq('target_id', filters.targetId);
  if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((d: Record<string, unknown>) => ({
    ...d,
    admin_email: (d.profiles as Record<string, string>)?.email,
  })) as unknown as AuditLogEntry[];
};

// ---- IA Consumption (for BarChart + 6-month summary) ----
export interface IaConsumptionRow {
  date: string;
  count: number;
  tokens: number;
  cost_usd: number;
}

export const getIaConsumption = async (orgId: string, days = 30): Promise<IaConsumptionRow[]> => {
  await requireAdmin();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('proposta_ai')
    .select('created_at, tokens_usados, custo_usd')
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const map = new Map<string, { count: number; tokens: number; cost_usd: number }>();
  for (const r of data ?? []) {
    const day = (r.created_at as string).slice(0, 10);
    const entry = map.get(day) ?? { count: 0, tokens: 0, cost_usd: 0 };
    entry.count++;
    entry.tokens += Number(r.tokens_usados ?? 0);
    entry.cost_usd += Number(r.custo_usd ?? 0);
    map.set(day, entry);
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
};

/** 6-month summary: month label, total tokens, total cost */
export const getIaMonthlySummary = async (orgId: string): Promise<{ month: string; tokens: number; cost_usd: number; count: number }[]> => {
  await requireAdmin();
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('proposta_ai')
    .select('created_at, tokens_usados, custo_usd')
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const months = new Map<string, { tokens: number; cost_usd: number; count: number }>();
  for (const r of data ?? []) {
    const month = (r.created_at as string).slice(0, 7);
    const entry = months.get(month) ?? { tokens: 0, cost_usd: 0, count: 0 };
    entry.count++;
    entry.tokens += Number(r.tokens_usados ?? 0);
    entry.cost_usd += Number(r.custo_usd ?? 0);
    months.set(month, entry);
  }
  return Array.from(months.entries()).map(([month, v]) => ({ month, ...v }));
};
