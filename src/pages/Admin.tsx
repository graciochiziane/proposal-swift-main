import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Plus,
  ArrowUpDown,
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
  Building2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listTenants, getAuditLog } from '@/services/adminService';
import type { Tenant, AuditLogEntry, PlanTier, CreateTenantData } from '@/types/admin';

// ---- Types ----
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

  // Tenants tab state
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [showIaAlert, setShowIaAlert] = useState(false);
  const [tenantSort, setTenantSort] = useState<'created_at' | 'last_proposal_created_at' | 'monthly_price'>('created_at');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showPlanLimits, setShowPlanLimits] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantData>({ nome: '', email: '', plano: 'free' });
  const [creating, setCreating] = useState(false);
  const [auditTenantFilter, setAuditTenantFilter] = useState('');
  const [summary24h, setSummary24h] = useState({ proposals: 0, members: 0, ia: 0 });
  const [planLimitsMap, setPlanLimitsMap] = useState<Record<string, number>>({});

  // Audit tab state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');

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

  // Load tenants data
  const loadTenantsData = async () => {
    setLoadingTenants(true);
    try {
      const data = await listTenants();
      setTenants(data);
    } catch {
      toast.error('Erro ao carregar tenants');
    }
    setLoadingTenants(false);
  };

  // Load audit log
  const loadAuditData = async () => {
    setLoadingAudit(true);
    try {
      const data = await getAuditLog({
        action: auditActionFilter || undefined,
        dateFrom: auditDateFrom || undefined,
        dateTo: auditDateTo || undefined,
      });
      setAuditLogs(data);
    } catch {
      toast.error('Erro ao carregar auditoria');
    }
    setLoadingAudit(false);
  };

  // Load 24h summary
  const loadSummary24h = async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [pRes, mRes, iaRes] = await Promise.all([
      supabase.from('proposals').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('organization_members').select('id', { count: 'exact', head: true }).gte('joined_at', since),
      supabase.from('proposta_ai').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    setSummary24h({ proposals: pRes.count ?? 0, members: mRes.count ?? 0, ia: iaRes.count ?? 0 });
  };

  // Create tenant
  const handleCreateTenant = async () => {
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
  };

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
      loadTenantsData();
      loadAuditData();
      loadSummary24h();
      // Carregar limites dos planos para alerta IA >80%
      supabase.from('plan_limits').select('plano, geracoes_ia_mes').then(({ data }) => {
        const map: Record<string, number> = {};
        (data ?? []).forEach(r => { map[r.plano as string] = r.geracoes_ia_mes as number; });
        setPlanLimitsMap(map);
      });
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

  // Tenants filtered, sorted, IA alert
  const filteredTenants = useMemo(() => {
    let list = [...tenants];
    const q = tenantSearch.trim().toLowerCase();
    if (q) list = list.filter(t => t.nome.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.contact_email ?? '').toLowerCase().includes(q));
    if (showIaAlert) list = list.filter(t => {
      const limit = planLimitsMap[t.plano];
      if (!limit || limit >= 2147483647) return false; // plano ilimitado
      return limit > 0 && (t.geracoes_ia_mes_count / limit) > 0.8;
    });
    // Sort
    const sortKey = tenantSort;
    list.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (sortKey === 'monthly_price') return Number(bVal) - Number(aVal);
      return String(bVal).localeCompare(String(aVal));
    });
    return list;
  }, [tenants, tenantSearch, showIaAlert, tenantSort, planLimitsMap]);

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
          <TabsTrigger value="tenants" className="gap-2">
            <Building2 className="h-4 w-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Shield className="h-4 w-4" />
            Auditoria
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

              {/* ---- 24h Summary ---- */}
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Últimas 24 horas</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{summary24h.proposals}</div>
                      <p className="text-xs text-muted-foreground">Propostas criadas</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{summary24h.members}</div>
                      <p className="text-xs text-muted-foreground">Novos membros</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{summary24h.ia}</div>
                      <p className="text-xs text-muted-foreground">Gerações IA</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

        {/* ============================== */}
        {/* TAB: TENANTS                   */}
        {/* ============================== */}
        <TabsContent value="tenants" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{tenants.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Suspensos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{tenants.filter(t => t.suspended_at).length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Plano Business</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{tenants.filter(t => t.plano === 'business').length}</div></CardContent>
            </Card>
          </div>

          {/* Tenant table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Tenants</CardTitle>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pesquisar nome, slug ou email..." value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTenantSort('created_at')} className={`gap-1 ${tenantSort === 'created_at' ? 'border-primary' : ''}`}>
                    <ArrowUpDown className="h-3 w-3" /> Data
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTenantSort('last_proposal_created_at')} className={`gap-1 ${tenantSort === 'last_proposal_created_at' ? 'border-primary' : ''}`}>
                    <ArrowUpDown className="h-3 w-3" /> Actividade
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTenantSort('monthly_price')} className={`gap-1 ${tenantSort === 'monthly_price' ? 'border-primary' : ''}`}>
                    <ArrowUpDown className="h-3 w-3" /> Receita
                  </Button>
                  <Button variant={showIaAlert ? 'destructive' : 'outline'} size="sm" onClick={() => setShowIaAlert(v => !v)} className="gap-1 whitespace-nowrap">
                    <AlertTriangle className="h-3.5 w-3.5" />{' '}Alerta IA &gt;80%
                  </Button>
                  <Button size="sm" onClick={() => setShowCreateTenant(true)} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Novo Tenant
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPlanLimits(true)} className="gap-1">
                    <Layers className="h-3.5 w-3.5" /> Planos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTenants ? (
                <div className="text-muted-foreground py-8 text-center">A carregar...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-right">Propostas/mês</TableHead>
                        <TableHead className="text-right">IA/mês</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Criação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map(t => (
                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/tenants/${t.id}`)}>
                          <TableCell className="font-medium">{t.nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.contact_email || '—'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${planBadge[t.plano]}`}>{t.plano.toUpperCase()}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{t.propostas_mes_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.geracoes_ia_mes_count}</TableCell>
                          <TableCell>
                            {t.suspended_at ? (
                              <span className="text-destructive text-xs font-medium">Suspenso</span>
                            ) : (
                              <span className="text-green-600 text-xs">Activo</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-PT')}</TableCell>
                        </TableRow>
                      ))}
                      {filteredTenants.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum tenant encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== */}
        {/* TAB: AUDIT (Fase 5.2)          */}
        {/* ============================== */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Registo de Auditoria</CardTitle>
                <div className="flex items-center gap-3 flex-wrap">
                  <Input placeholder="Acção (ex: tenant_update)" value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} className="w-full sm:w-40" />
                  <select className="rounded-md border bg-background px-3 py-2 text-sm max-w-[180px]"
                    value={auditTenantFilter} onChange={e => setAuditTenantFilter(e.target.value)}>
                    <option value="">Todos os tenants</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <Input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} className="w-full sm:w-40" />
                  <Input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} className="w-full sm:w-40" />
                  <Button size="sm" variant="outline" onClick={loadAuditData}>Filtrar</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAudit ? (
                <div className="text-muted-foreground py-8 text-center">A carregar...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Acção</TableHead>
                        <TableHead>Tabela</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.filter(l => !auditTenantFilter || l.target_id === auditTenantFilter).map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-PT')}</TableCell>
                          <TableCell className="text-sm">{l.admin_email}</TableCell>
                          <TableCell className="font-medium text-sm">{l.action}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.target_table || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.target_snapshot ? JSON.stringify(l.target_snapshot) : '—'}</TableCell>
                        </TableRow>
                      ))}
                      {auditLogs.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem registos</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Tenant Dialog */}
        <Dialog open={showCreateTenant} onOpenChange={setShowCreateTenant}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Tenant</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={newTenant.nome} onChange={e => setNewTenant(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email de contacto</label>
                <Input type="email" value={newTenant.email} onChange={e => setNewTenant(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NUIT</label>
                <Input value={newTenant.nuit || ''} onChange={e => setNewTenant(p => ({ ...p, nuit: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Plano</label>
                <select className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                  value={newTenant.plano} onChange={e => setNewTenant(p => ({ ...p, plano: e.target.value as PlanTier }))}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <Button onClick={handleCreateTenant} disabled={creating} className="w-full">{creating ? 'A criar...' : 'Criar Tenant'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Plan Limits Dialog */}
        <Dialog open={showPlanLimits} onOpenChange={setShowPlanLimits}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Gestão de Planos</DialogTitle></DialogHeader>
            <PlanLimitsManager onClose={() => setShowPlanLimits(false)} />
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
}

// ---- Plan Limits Sub-component ----
function PlanLimitsManager({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<{ plano: string; propostas_mes: number; geracoes_ia_mes: number; clientes_max: number | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('plan_limits').select('*').then(({ data }) => setPlans((data ?? []) as typeof plans));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const p of plans) {
      await supabase.from('plan_limits').update({
        propostas_mes: p.propostas_mes,
        geracoes_ia_mes: p.geracoes_ia_mes,
        clientes_max: p.clientes_max,
      }).eq('plano', p.plano);
    }
    toast.success('Planos actualizados');
    setSaving(false);
    onClose();
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plano</TableHead>
            <TableHead className="text-right">Propostas/mês</TableHead>
            <TableHead className="text-right">IA/mês</TableHead>
            <TableHead className="text-right">Clientes max</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map(p => (
            <TableRow key={p.plano}>
              <TableCell className="font-medium capitalize">{p.plano}</TableCell>
              <TableCell><Input type="number" className="w-24 text-right" value={p.propostas_mes === 2147483647 ? '' : p.propostas_mes} placeholder="∞" onChange={e => setPlans(plans.map(x => x.plano === p.plano ? { ...x, propostas_mes: e.target.value ? Number(e.target.value) : 2147483647 } : x))} /></TableCell>
              <TableCell><Input type="number" className="w-24 text-right" value={p.geracoes_ia_mes === 2147483647 ? '' : p.geracoes_ia_mes} placeholder="∞" onChange={e => setPlans(plans.map(x => x.plano === p.plano ? { ...x, geracoes_ia_mes: e.target.value ? Number(e.target.value) : 2147483647 } : x))} /></TableCell>
              <TableCell><Input type="number" className="w-24 text-right" value={p.clientes_max ?? ''} placeholder="∞" onChange={e => setPlans(plans.map(x => x.plano === p.plano ? { ...x, clientes_max: e.target.value ? Number(e.target.value) : null } : x))} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleSave} disabled={saving} className="w-full mt-4">{saving ? 'A guardar...' : 'Guardar'}</Button>
    </>
  );
}