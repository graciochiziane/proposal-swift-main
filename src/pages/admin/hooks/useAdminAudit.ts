// ============================================================
// Hook: useAdminAudit — loads audit log with server-side filters
// Extracted from Admin.tsx lines 160-165, 193-206
// FIX 0.3: target_id now filtered on server, not client
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AuditLogEntry } from '@/types/admin';

export function useAdminAudit(isAdmin: boolean) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditTenantFilter, setAuditTenantFilter] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');

  const loadAuditData = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('admin_audit_log')
        .select('*, profiles!inner(email)')
        .order('created_at', { ascending: false })
        .limit(200);

      // FIX 0.3: filter on server instead of client
      if (auditActionFilter) q = q.eq('action', auditActionFilter);
      if (auditTenantFilter) q = q.eq('target_id', auditTenantFilter);
      if (auditDateFrom) q = q.gte('created_at', auditDateFrom);
      if (auditDateTo) q = q.lte('created_at', auditDateTo);

      const { data, error } = await q;
      if (error) throw error;

      setAuditLogs((data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        admin_email: (d.profiles as Record<string, string>)?.email,
      })) as unknown as AuditLogEntry[]);
    } catch {
      toast.error('Erro ao carregar auditoria');
    }
    setLoading(false);
  }, [auditActionFilter, auditTenantFilter, auditDateFrom, auditDateTo]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAuditData();
  }, [isAdmin, loadAuditData]);

  return {
    auditLogs, loading, loadAuditData,
    auditActionFilter, setAuditActionFilter,
    auditTenantFilter, setAuditTenantFilter,
    auditDateFrom, setAuditDateFrom,
    auditDateTo, setAuditDateTo,
  };
}