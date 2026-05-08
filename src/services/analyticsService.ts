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
   */
  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const now = new Date();
    const today = formatDate(now);
    const weekAgo = formatDate(daysAgo(7));
    const monthAgo = formatDate(daysAgo(30));
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [
      profilesRes,
      onlineRes,
      todayRes,
      weekRes,
      monthRes,
      signupsMonthRes,
      proposalsMonthRes,
      proposalsValueRes,
      clientsMonthRes,
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('id', { count: 'exact', head: true }),

      // Online now (últimos 15 min)
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('last_seen_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),

      // Acessaram hoje
      supabase
        .from('user_activity')
        .select('user_id')
        .gte('created_at', `${today}T00:00:00`),

      // Acessaram na semana
      supabase
        .from('user_activity')
        .select('user_id')
        .gte('created_at', `${weekAgo}T00:00:00`),

      // Acessaram no mês
      supabase
        .from('user_activity')
        .select('user_id')
        .gte('created_at', `${monthAgo}T00:00:00`),

      // Novos registos este mês
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00`),

      // Propostas este mês
      supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00`),

      // Valor total de propostas
      supabase
        .from('proposals')
        .select('total'),

      // Clientes criados este mês
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00`),
    ]);

    // Únicos por período
    const uniqueUsers = (data: { user_id: string }[] | null) => {
      if (!data) return 0;
      return new Set(data.map(r => r.user_id)).size;
    };

    const proposalsValue = (proposalsValueRes.data ?? []).reduce(
      (sum, r) => sum + Number(r.total ?? 0), 0
    );

    return {
      users_online_now: onlineRes.count ?? 0,
      accessed_today: uniqueUsers(todayRes.data),
      accessed_week: uniqueUsers(weekRes.data),
      accessed_month: uniqueUsers(monthRes.data),
      total_users: profilesRes.count ?? 0,
      new_signups_this_month: signupsMonthRes.count ?? 0,
      proposals_this_month: proposalsMonthRes.count ?? 0,
      clients_this_month: clientsMonthRes.count ?? 0,
      proposals_total_value: proposalsValue,
    };
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

    return sorted.map(([userId, visits]) => {
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
