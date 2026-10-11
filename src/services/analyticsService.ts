// ============================================================
// Analytics Service — Platform-wide metrics
//
// P1-H6 (2026-08-13): Added requireAdmin() to all read methods.
// FIX (2026-08-13): Removed requireAdmin() from read methods.
//   The RLS policies + SECURITY DEFINER RPCs already enforce admin
//   access. The client-side check was causing the admin panel to
//   go blank due to session/timing issues. RLS is the real guard.
//   trackPageVisit() remains open (RLS enforces user_id = auth.uid()).
// ============================================================
import { supabase } from '@/integrations/supabase/client';

// ---- Types ----
interface DayMetric {
  date: string;      // YYYY-MM-DD
  count: number;
}

interface ActiveUser {
  id: string;
  email: string;
  nome: string | null;
  plano: string;
  last_seen_at: string | null;
  visits_today: number;
}

interface SignupData {
  date: string;
  total: number;
}

interface ProposalMetric {
  date: string;
  count: number;
  total_value: number;
}

interface PlatformMetrics {
  users_online_now: number;
  accessed_today: number;
  accessed_week: number;
  accessed_month: number;
  total_users: number;
  new_signups_this_month: number;
  proposals_this_month: number;
  clients_this_month: number;
  proposals_total_value: number;
}

// ---- Helpers ----
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ---- Core Analytics Service ----
export const analyticsService = {

  /**
   * Carrega todas as métricas principais do dashboard
   * FIX 2.1: Usa RPC admin_platform_metrics() em vez de 9 queries
   */
  async getPlatformMetrics(): Promise<PlatformMetrics> {

    const { data, error } = await supabase.rpc('admin_platform_metrics');
    if (error) throw error;
    return data as unknown as PlatformMetrics;
  },

  /**
   * Utilizadores actualmente online (últimos 15 min)
   */
  async getOnlineUsers(): Promise<ActiveUser[]> {

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const today = formatDate(new Date());

    const [profilesRes, activityRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, nome, plano, last_seen_at')
        .gt('last_seen_at', fifteenMinAgo)
        .order('last_seen_at', { ascending: false }),

      supabase
        .from('user_activity')
        .select('user_id')
        .gte('created_at', `${today}T00:00:00`),
    ]);

    const profiles = profilesRes.data ?? [];
    // Contar visitas hoje por user
    const visitCounts = new Map<string, number>();
    (activityRes.data ?? []).forEach(r => {
      visitCounts.set(r.user_id, (visitCounts.get(r.user_id) ?? 0) + 1);
    });

    return profiles.map(p => ({
      id: p.id,
      email: p.email,
      nome: p.nome,
      plano: p.plano,
      last_seen_at: p.last_seen_at,
      visits_today: visitCounts.get(p.id) ?? 0,
    }));
  },

  /**
   * Novos registos por dia (últimos N dias)
   */
  async getSignupsByDay(days: number): Promise<SignupData[]> {

    const startDate = formatDate(daysAgo(days));
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    // Agrupar por dia com total acumulado
    const byDay = new Map<string, number>();
    let total = 0;

    // Contar users registados antes do período para o acumulado
    const { count: beforeCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', `${startDate}T00:00:00`);
    total = beforeCount ?? 0;

    const result: SignupData[] = [];

    // Gerar todos os dias do intervalo
    for (let i = days; i >= 0; i--) {
      const date = formatDate(daysAgo(i));
      const dayUsers = data.filter(r => formatDate(new Date(r.created_at)) === date);
      total += dayUsers.length;
      byDay.set(date, total);
      result.push({ date, total });
    }

    return result;
  },

  /**
   * Utilizadores activos por dia (últimos N dias)
   */
  async getDailyActiveUsers(days: number): Promise<DayMetric[]> {

    const startDate = formatDate(daysAgo(days));
    const { data, error } = await supabase
      .from('user_activity')
      .select('user_id, created_at')
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    const byDay = new Map<string, Set<string>>();
    const result: DayMetric[] = [];

    // Gerar todos os dias
    for (let i = days; i >= 0; i--) {
      const date = formatDate(daysAgo(i));
      byDay.set(date, new Set());
    }

    data.forEach(r => {
      const date = formatDate(new Date(r.created_at));
      const set = byDay.get(date);
      if (set) set.add(r.user_id);
    });

    byDay.forEach((set, date) => {
      result.push({ date, count: set.size });
    });

    return result;
  },

  /**
   * Propostas criadas por dia (últimos N dias)
   */
  async getProposalsByDay(days: number): Promise<ProposalMetric[]> {

    const startDate = formatDate(daysAgo(days));
    const { data, error } = await supabase
      .from('proposals')
      .select('created_at, total')
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    const byDay = new Map<string, { count: number; value: number }>();
    const result: ProposalMetric[] = [];

    for (let i = days; i >= 0; i--) {
      byDay.set(formatDate(daysAgo(i)), { count: 0, value: 0 });
    }

    data.forEach(r => {
      const date = formatDate(new Date(r.created_at));
      const entry = byDay.get(date);
      if (entry) {
        entry.count++;
        entry.value += Number(r.total ?? 0);
      }
    });

    byDay.forEach((entry, date) => {
      result.push({ date, count: entry.count, total_value: entry.value });
    });

    return result;
  },

  /**
   * Utilizadores mais activos (últimos N dias)
   */
  async getMostActiveUsers(days: number, limit: number = 10): Promise<ActiveUser[]> {

    const startDate = formatDate(daysAgo(days));

    const { data, error } = await supabase
      .from('user_activity')
      .select('user_id')
      .gte('created_at', `${startDate}T00:00:00`);

    if (error || !data) return [];

    // Contar visitas por user
    const visitCounts = new Map<string, number>();
    data.forEach(r => {
      visitCounts.set(r.user_id, (visitCounts.get(r.user_id) ?? 0) + 1);
    });

    // Ordenar por visitas (desc) e buscar top N perfis
    const sorted = [...visitCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const userIds = sorted.map(([id]) => id);
    if (userIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, nome, plano, last_seen_at')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    return sorted.map(([userId]) => {
      const p = profileMap.get(userId);
      return {
        id: userId,
        email: p?.email ?? '',
        nome: p?.nome ?? null,
        plano: p?.plano ?? 'free',
        last_seen_at: p?.last_seen_at ?? null,
        visits_today: 0, // não é relevante aqui
      };
    }).map(u => ({ ...u, visits_today: visitCounts.get(u.id) ?? 0 }));
  },

  /**
   * Gravar uma visita à página (chamado pelo hook useActivityTracker)
   * Deduplica: só insere se última visita do user foi há mais de 5 minutos
   *
   * NOTA: Este método NÃO requer admin — qualquer utilizador autenticado
   * pode gravar a sua própria atividade. RLS policy em user_activity
   * garante que user_id = auth.uid() no INSERT.
   */
  async trackPageVisit(userId: string, page: string): Promise<void> {
    try {
      // Actualizar last_seen_at no perfil
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId);

      // Verificar última visita (deduplicar a cada 5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: lastVisit } = await supabase
        .from('user_activity')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastVisit && lastVisit.length > 0 && lastVisit[0].created_at > fiveMinAgo) {
        return; // Já registou visita recentemente
      }

      // Inserir nova visita
      await supabase
        .from('user_activity')
        .insert({ user_id: userId, page });
    } catch (err) {
      // Falha silenciosa — não deve quebrar a app
      console.warn('Activity tracking failed:', err);
    }
  },
};

