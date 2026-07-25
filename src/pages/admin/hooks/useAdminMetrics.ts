// ============================================================
// Hook: useAdminMetrics — loads all platform metrics data
// Extracted from Admin.tsx lines 136-142, 271-295, 297-320
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { analyticsService } from '@/services/analyticsService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Summary24h {
  proposals: number;
  members: number;
  ia: number;
}

export function useAdminMetrics(activeTab: string, isAdmin: boolean) {
  const [metrics, setMetrics] = useState<ReturnType<typeof analyticsService.getPlatformMetrics> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Awaited<ReturnType<typeof analyticsService.getOnlineUsers>>>([]);
  const [dauData, setDauData] = useState<{ date: string; count: number }[]>([]);
  const [signupData, setSignupData] = useState<{ date: string; total: number }[]>([]);
  const [proposalDayData, setProposalDayData] = useState<{ date: string; count: number; total_value: number }[]>([]);
  const [mostActive, setMostActive] = useState<Awaited<ReturnType<typeof analyticsService.getMostActiveUsers>>>([]);
  const [loading, setLoading] = useState(true);
  const [summary24h, setSummary24h] = useState<Summary24h>({ proposals: 0, members: 0, ia: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, online, dau, signups, proposals, active] = await Promise.all([
        analyticsService.getPlatformMetrics(),
        analyticsService.getOnlineUsers(),
        analyticsService.getDailyActiveUsers(30),
        analyticsService.getSignupsByDay(30),
        analyticsService.getProposalsByDay(30),
        analyticsService.getMostActiveUsers(30, 5),
      ]);

      setMetrics(metricsData);
      setOnlineUsers(online);
      setDauData(dau);
      setSignupData(signups);
      setProposalDayData(proposals);
      setMostActive(active);
    } catch (err) {
      console.error('Metrics load error:', err);
      toast.error('Erro ao carregar métricas');
    }
    setLoading(false);
  }, []);

  // Load 24h summary — FIX 0.2: wrapped in try/catch
  const loadSummary24h = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [pRes, mRes, iaRes] = await Promise.all([
        supabase.from('proposals').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }).gte('joined_at', since),
        supabase.from('proposta_ai').select('id', { count: 'exact', head: true }).gte('created_at', since),
      ]);
      setSummary24h({ proposals: pRes.count ?? 0, members: mRes.count ?? 0, ia: iaRes.count ?? 0 });
    } catch (err) {
      console.error('24h summary load error:', err);
      // Degrade gracefully — don't crash the tab
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
    loadSummary24h();
  }, [isAdmin, loadData, loadSummary24h]);

  // Auto-refresh metrics every 60 seconds
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      if (activeTab === 'metrics') loadData();
    }, 60_000);
    return () => clearInterval(interval);
  }, [isAdmin, activeTab, loadData]);

  return {
    metrics, onlineUsers, dauData, signupData, proposalDayData,
    mostActive, loading, summary24h, refresh: loadData,
  };
}
