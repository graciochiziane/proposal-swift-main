// ============================================================
// Hook: useAdminUsers — loads users, roles, proposal/client counts
// Extracted from Admin.tsx lines 128-133, 238-269, 344-368
// ============================================================
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AppRole, AdminUser } from '../constants';

export function useAdminUsers(isAdmin: boolean) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [proposalsCount, setProposalsCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes, proposalsRes, clientsRes] = await Promise.all([
      supabase.from('profiles').select('id, email, nome, plano, propostas_mes_count, last_seen_at, created_at').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('proposals').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
    ]);

    if (profilesRes.error) {
      toast.error('Erro ao carregar utilizadores');
      setLoading(false);
      return;
    }

    const rolesByUser = new Map<string, AppRole[]>();
    (rolesRes.data ?? []).forEach(r => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });

    setUsers(
      (profilesRes.data ?? []).map(p => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }))
    );
    setProposalsCount(proposalsRes.count ?? 0);
    setClientsCount(clientsRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u =>
        u.email.toLowerCase().includes(q) ||
        (u.nome ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const planDistribution = useMemo(() => {
    const d = { free: 0, pro: 0, business: 0 };
    users.forEach(u => { d[u.plano]++; });
    return d;
  }, [users]);

  // Actions (with FIX 3.3: audit logging)
  const changePlan = async (u: AdminUser, plano: 'free' | 'pro' | 'business') => {
    const prev = u.plano;
    const { error } = await supabase
      .from('profiles')
      .update({ plano })
      .eq('id', u.id);
    if (error) return toast.error('Erro ao alterar plano');
    // FIX 3.3: Audit plan change from Users tab
    try {
      await supabase.from('admin_audit_log').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'plan_change',
        target_table: 'profiles',
        target_id: u.id,
        target_snapshot: { from: prev, to: plano, email: u.email },
      });
    } catch { /* audit failure is non-blocking */ }
    toast.success(`Plano de ${u.email} alterado para ${plano}`);
    loadData();
  };

  const toggleAdmin = async (u: AdminUser) => {
    const isCurrentlyAdmin = u.roles.includes('admin');
    const newAction = isCurrentlyAdmin ? 'role_remove_admin' : 'role_add_admin';
    if (isCurrentlyAdmin) {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', u.id)
        .eq('role', 'admin');
      if (error) return toast.error('Erro ao despromover');
      toast.success(`${u.email} despromovido`);
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: u.id, role: 'admin' });
      if (error) return toast.error('Erro ao promover');
      toast.success(`${u.email} promovido a admin`);
    }
    // FIX 3.3: Audit role change
    try {
      await supabase.from('admin_audit_log').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: newAction,
        target_table: 'user_roles',
        target_id: u.id,
        target_snapshot: { email: u.email, role: 'admin' },
      });
    } catch { /* non-blocking */ }
    loadData();
  };

  const resetCounter = async (u: AdminUser) => {
    const { error } = await supabase
      .from('profiles')
      .update({ propostas_mes_count: 0 })
      .eq('id', u.id);
    if (error) return toast.error('Erro ao resetar');
    toast.success('Contador resetado');
    loadData();
  };

  return {
    users, filtered, loading, search, setSearch,
    proposalsCount, clientsCount, planDistribution,
    changePlan, toggleAdmin, resetCounter,
  };
}
