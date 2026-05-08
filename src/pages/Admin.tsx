import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Line, LineChart, ResponsiveContainer } from 'recharts';
import {
  MoreHorizontal,
  Search,
  Users,
  FileText,
  UserCheck,
  Layers,
  Activity,
  Wifi,
  UserPlus,
  Eye,
  TrendingUp,
  Clock,
  RefreshCw,
} from 'lucide-react';

// ---- Types ----
type PlanTier = 'free' | 'pro' | 'business';
type AppRole = 'admin' | 'user';

interface AdminUser {
  id: string;
  email: string;
  nome: string | null;
  plano: PlanTier;
  propostas_mes_count: number;
  created_at: string;
  roles: AppRole[];
}

// ---- Constants ----
const planBadge: Record<PlanTier, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  pro: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  business: 'bg-primary/15 text-primary border-primary/30',
};

const dauChartConfig: ChartConfig = {
  users: { label: 'Utilizadores activos', color: 'hsl(var(--chart-1))' },
};

const signupsChartConfig: ChartConfig = {
  total: { label: 'Total de utilizadores', color: 'hsl(var(--chart-2))' },
};

const proposalsChartConfig: ChartConfig = {
  count: { label: 'Propostas', color: 'hsl(var(--chart-3))' },
};

const valueChartConfig: ChartConfig = {
  value: { label: 'Valor (MT)', color: 'hsl(var(--chart-4))' },
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatMZNShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Desconhecido';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  return `Há ${Math.floor(hours / 24)}d`;
}

// ============================================================
// Admin Component
// ============================================================
export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Users tab state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [proposalsCount, setProposalsCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');

  // Metrics tab state
  const [metrics, setMetrics] = useState<ReturnType<typeof analyticsService.getPlatformMetrics> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Awaited<ReturnType<typeof analyticsService.getOnlineUsers>>>([]);
  const [dauData, setDauData] = useState<{ date: string; count: number }[]>([]);
  const [signupData, setSignupData] = useState<{ date: string; total: number }[]>([]);
  const [proposalDayData, setProposalDayData] = useState<{ date: string; count: number; total_value: number }[]>([]);
  const [mostActive, setMostActive] = useState<Awaited<ReturnType<typeof analyticsService.getMostActiveUsers>>>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [activeTab, setActiveTab] = useState('metrics');

  // Verify admin
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsAdmin(!!data?.some(r => r.role === 'admin'));
      setCheckingRole(false);
    })();
  }, [user]);

  // Load users data
  const loadUsersData = async () => {
    setLoadingUsers(true);
    const [profilesRes, rolesRes, proposalsRes, clientsRes] = await Promise.all([
      supabase.from('profiles').select('id, email, nome, plano, propostas_mes_count, created_at').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('proposals').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
    ]);

    if (profilesRes.error) {
      toast.error('Erro ao carregar utilizadores');
      setLoadingUsers(false);
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
    setLoadingUsers(false);
  };

  // Load metrics data
  const loadMetricsData = async () => {
    setLoadingMetrics(true);
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
    setLoadingMetrics(false);
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsersData();
      loadMetricsData();
    }
  }, [isAdmin]);

  // Auto-refresh metrics every 60 seconds
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      if (activeTab === 'metrics') loadMetricsData();
    }, 60_000);
    return () => clearInterval(interval);
  }, [isAdmin, activeTab]);

  // Users tab logic
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

  const changePlan = async (u: AdminUser, plano: PlanTier) => {
    const { error } = await supabase
      .from('profiles')
      .update({ plano })
      .eq('id', u.id);
    if (error) return toast.error('Erro ao alterar plano');
    toast.success(`Plano de ${u.email} alterado para ${plano}`);
    loadUsersData();
  };

  const toggleAdmin = async (u: AdminUser) => {
    const isCurrentlyAdmin = u.roles.includes('admin');
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
    loadUsersData();
  };

  const resetCounter = async (u: AdminUser) => {
    const { error } = await supabase
      .from('profiles')
      .update({ propostas_mes_count: 0 })
      .eq('id', u.id);
    if (error) return toast.error('Erro ao resetar');
    toast.success('Contador resetado');
    loadUsersData();
  };

  if (authLoading || checkingRole) {
    return <div className="p-8 text-muted-foreground">A verificar permissões...</div>;
  }

  if (!isAdmin) {
    toast.error('Acesso negado: área restrita a administradores');
    return <Navigate to="/" replace />;
  }

  const initials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel SuperAdmin</h1>
          <p className="text-sm text-muted-foreground">Gestão global e métricas da plataforma</p>
        </div>
        {activeTab === 'metrics' && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetricsData}
            disabled={loadingMetrics}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="metrics" className="gap-2">
            <Activity className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Utilizadores
          </TabsTrigger>
        </TabsList>

        {/* ============================== */}
        {/* TAB: METRICS                    */}
        {/* ============================== */}
        <TabsContent value="metrics" className="space-y-6">

          {/* Loading skeleton */}
          {loadingMetrics && !metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i}><CardContent className="p-6"><div className="h-4 bg-muted rounded animate-pulse" /></CardContent></Card>
              ))}
            </div>
          ) : metrics && (
            <>
              {/* ---- Primary KPIs ---- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Online Now */}
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Online Agora</CardTitle>
                    <div className="relative">
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{metrics.users_online_now}</div>
                    <p className="text-xs text-muted-foreground mt-1">últimos 15 minutos</p>
                  </CardContent>
                </Card>

                {/* Accessed Today */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Acessaram Hoje</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics.accessed_today}</div>
                    <p className="text-xs text-muted-foreground mt-1">de {metrics.total_users} registados</p>
                    <Progress
                      value={metrics.total_users > 0 ? (metrics.accessed_today / metrics.total_users) * 100 : 0}
                      className="mt-2 h-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.total_users > 0
                        ? `${((metrics.accessed_today / metrics.total_users) * 100).toFixed(0)}% de activação diária`
                        : '—'}
                    </p>
                  </CardContent>
                </Card>

                {/* This Week */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Esta Semana</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics.accessed_week}</div>
                    <p className="text-xs text-muted-foreground mt-1">utilizadores activos (7 dias)</p>
                  </CardContent>
                </Card>

                {/* This Month */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Este Mês</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics.accessed_month}</div>
                    <p className="text-xs text-muted-foreground mt-1">utilizadores activos (30 dias)</p>
                  </CardContent>
                </Card>
              </div>

              {/* ---- Secondary KPIs ---- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Utilizadores</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.total_users}</div>
                    <p className="text-xs text-muted-foreground mt-1">+{metrics.new_signups_this_month} este mês</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Propostas (mês)</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.proposals_this_month}</div>
                    <p className="text-xs text-muted-foreground mt-1">total: {formatMZNShort(metrics.proposals_total_value)} MT</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Clientes (mês)</CardTitle>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.clients_this_month}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Por Plano</CardTitle>
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className={`px-2 py-1 rounded border ${planBadge.free}`}>Free {planDistribution.free}</span>
                      <span className={`px-2 py-1 rounded border ${planBadge.pro}`}>Pro {planDistribution.pro}</span>
                      <span className={`px-2 py-1 rounded border ${planBadge.business}`}>Biz {planDistribution.business}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ---- Online Users List ---- */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Utilizadores Online
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {onlineUsers.length} {onlineUsers.length === 1 ? 'utilizador' : 'utilizadores'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Wifi className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum utilizador online neste momento
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {onlineUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-green-500/10 text-green-600">
                              {initials(u.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.nome || u.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{timeAgo(u.last_seen_at)}</p>
                            <p className="text-[10px] text-muted-foreground">{u.visits_today} visitas hoje</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${planBadge[u.plano as PlanTier] ?? planBadge.free}`}>
                            {u.plano.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ---- Charts Row ---- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DAU Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Utilizadores Activos por Dia</CardTitle>
                    <p className="text-xs text-muted-foreground">Últimos 30 dias — utilizadores únicos por dia</p>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={dauChartConfig} className="h-[250px] w-full">
                      <BarChart data={dauData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatShortDate}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          fontSize={11}
                        />
                        <YAxis tickLine={false} axisLine={false} fontSize={11} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-users)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Signups Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Evolução de Registos</CardTitle>
                    <p className="text-xs text-muted-foreground">Últimos 30 dias — total acumulado</p>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={signupsChartConfig} className="h-[250px] w-full">
                      <LineChart data={signupData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatShortDate}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          fontSize={11}
                        />
                        <YAxis tickLine={false} axisLine={false} fontSize={11} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              {/* ---- Proposals Chart ---- */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Propostas Criadas por Dia</CardTitle>
                  <p className="text-xs text-muted-foreground">Últimos 30 dias — quantidade e valor</p>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{ ...proposalsChartConfig, ...valueChartConfig }} className="h-[250px] w-full">
                    <BarChart data={proposalDayData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatShortDate}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        fontSize={11}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* ---- Most Active Users ---- */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Utilizadores Mais Activos (30 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mostActive.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Sem dados de actividade</p>
                    ) : (
                      mostActive.map((u, idx) => (
                        <div key={u.id} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                            {idx + 1}
                          </span>
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs">{initials(u.nome)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.nome || u.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{u.visits_today} visitas</p>
                            <p className="text-xs text-muted-foreground">{timeAgo(u.last_seen_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ============================== */}
        {/* TAB: USERS                     */}
        {/* ============================== */}
        <TabsContent value="users" className="space-y-6">
          {/* Same metric cards as before */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Utilizadores</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Propostas</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{proposalsCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientsCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Por Plano</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded border ${planBadge.free}`}>Free {planDistribution.free}</span>
                  <span className={`px-2 py-1 rounded border ${planBadge.pro}`}>Pro {planDistribution.pro}</span>
                  <span className={`px-2 py-1 rounded border ${planBadge.business}`}>Biz {planDistribution.business}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Utilizadores</CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar nome ou email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="text-muted-foreground py-8 text-center">A carregar...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Propostas/mês</TableHead>
                        <TableHead>Registo</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(u => {
                        const isUserAdmin = u.roles.includes('admin');
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.nome || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${planBadge[u.plano]}`}>
                                {u.plano.toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell>
                              {isUserAdmin ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-accent/15 text-accent border-accent/30">
                                  ADMIN
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">user</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{u.propostas_mes_count}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString('pt-PT')}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {/* last_seen_at still loaded from profiles */}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuLabel>Mudar plano</DropdownMenuLabel>
                                  <DropdownMenuItem disabled={u.plano === 'free'} onClick={() => changePlan(u, 'free')}>Free</DropdownMenuItem>
                                  <DropdownMenuItem disabled={u.plano === 'pro'} onClick={() => changePlan(u, 'pro')}>Pro</DropdownMenuItem>
                                  <DropdownMenuItem disabled={u.plano === 'business'} onClick={() => changePlan(u, 'business')}>Business</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => toggleAdmin(u)}
                                    disabled={u.id === user?.id}
                                  >
                                    {isUserAdmin ? 'Remover admin' : 'Promover a admin'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => resetCounter(u)}>
                                    Reset contador propostas
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum utilizador encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
