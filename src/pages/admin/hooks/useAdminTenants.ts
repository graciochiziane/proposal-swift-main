// ============================================================
// Hook: useAdminTenants — loads tenants + plan limits for IA alert
// Extracted from Admin.tsx lines 145-158, 181-190, 304-341
// ============================================================
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { listTenants } from '@/services/adminService';
import type { Tenant, CreateTenantData } from '@/types/admin';

type TenantSortKey = 'created_at' | 'last_proposal_created_at' | 'monthly_price';

export function useAdminTenants(isAdmin: boolean) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [showIaAlert, setShowIaAlert] = useState(false);
  const [tenantSort, setTenantSort] = useState<TenantSortKey>('created_at');
  const [planLimitsMap, setPlanLimitsMap] = useState<Record<string, number>>({});
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showPlanLimits, setShowPlanLimits] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantData>({ nome: '', email: '', plano: 'free' });
  const [creating, setCreating] = useState(false);

  const loadTenantsData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTenants();
      setTenants(data);
    } catch {
      toast.error('Erro ao carregar tenants');
    }
    setLoading(false);
  }, []);

  const loadPlanLimits = useCallback(async () => {
    const { data } = await supabase.from('plan_limits').select('plano, geracoes_ia_mes');
    const map: Record<string, number> = {};
    (data ?? []).forEach(r => { map[r.plano as string] = r.geracoes_ia_mes as number; });
    setPlanLimitsMap(map);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadTenantsData();
    loadPlanLimits();
  }, [isAdmin, loadTenantsData, loadPlanLimits]);

  // Create tenant
  const handleCreateTenant = useCallback(async () => {
    if (!newTenant.nome || !newTenant.email) { toast.error('Nome e email obrigatórios'); return; }
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke('admin-create-tenant', { body: newTenant });
      if (error) throw error;
      toast.success('Tenant criado com sucesso');
      setShowCreateTenant(false);
      setNewTenant({ nome: '', email: '', plano: 'free' });
      loadTenantsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar tenant';
      toast.error(msg);
    }
    setCreating(false);
  }, [newTenant, loadTenantsData]);

  // Filtered, sorted, IA alert
  const filteredTenants = useMemo(() => {
    let list = [...tenants];
    const q = tenantSearch.trim().toLowerCase();
    if (q) list = list.filter(t => t.nome.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.contact_email ?? '').toLowerCase().includes(q));
    if (showIaAlert) list = list.filter(t => {
      const limit = planLimitsMap[t.plano];
      if (!limit || limit >= 2147483647) return false;
      return limit > 0 && (t.geracoes_ia_mes_count / limit) > 0.8;
    });
    list.sort((a, b) => {
      const aVal = a[tenantSort] ?? '';
      const bVal = b[tenantSort] ?? '';
      if (tenantSort === 'monthly_price') return Number(bVal) - Number(aVal);
      return String(bVal).localeCompare(String(aVal));
    });
    return list;
  }, [tenants, tenantSearch, showIaAlert, tenantSort, planLimitsMap]);

  return {
    tenants, loading, tenantSearch, setTenantSearch,
    showIaAlert, setShowIaAlert, tenantSort, setTenantSort,
    filteredTenants,
    showCreateTenant, setShowCreateTenant,
    showPlanLimits, setShowPlanLimits,
    newTenant, setNewTenant, creating, handleCreateTenant,
  };
}