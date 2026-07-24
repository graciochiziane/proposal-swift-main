// ============================================================
// Admin Service — Fase 4 SuperAdmin Panel
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type { Tenant, TenantDetail, TenantMember, AuditLogEntry, UpdateTenantData } from '@/types/admin';

// ---- Helpers ----
const logAction = async (action: string, targetTable?: string, targetId?: string, targetOwnerId?: string, snapshot?: Record<string, unknown>) => {
  await supabase.from('admin_audit_log').insert({
    admin_id: (await supabase.auth.getUser()).data.user?.id,
    action,
    target_table: targetTable,
    target_id: targetId,
    target_owner_id: targetOwnerId,
    target_snapshot: snapshot ?? {},
  });
};

// ---- Tenants ----
export const listTenants = async (): Promise<Tenant[]> => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tenant[];
};

export const getTenant = async (id: string): Promise<TenantDetail | null> => {
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
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, organization_id, role, joined_at, invited_by, profiles!inner(nome, email)')
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TenantMember[];
};

export const toggleSuspend = async (orgId: string, suspend: boolean, reason = '') => {
  const { error } = await supabase.rpc('admin_toggle_suspend', {
    p_org_id: orgId,
    p_suspend: suspend,
    p_reason: reason,
  });
  if (error) throw error;
  await logAction(suspend ? 'tenant_suspend' : 'tenant_reactivate', 'organizations', orgId);
};

export const updateTenant = async (id: string, data: UpdateTenantData) => {
  const { error } = await supabase.from('organizations').update(data).eq('id', id);
  if (error) throw error;
  await logAction('tenant_update', 'organizations', id, undefined, data as unknown as Record<string, unknown>);
};

// ---- Audit Log ----
export const getAuditLog = async (filters?: { action?: string; dateFrom?: string; dateTo?: string }): Promise<AuditLogEntry[]> => {
  let q = supabase
    .from('admin_audit_log')
    .select('*, profiles!inner(email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters?.action) q = q.eq('action', filters.action);
  if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((d: Record<string, unknown>) => ({
    ...d,
    admin_email: (d.profiles as Record<string, string>)?.email,
  })) as unknown as AuditLogEntry[];
};

// ---- IA Consumption (for BarChart) ----
export const getIaConsumption = async (orgId: string, days = 30): Promise<{ date: string; count: number }[]> => {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('proposta_ai')
    .select('created_at')
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const day = (r.created_at as string).slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
};
