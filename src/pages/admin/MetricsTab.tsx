// ============================================================
// MetricsTab — Platform metrics dashboard
// Extracted from Admin.tsx lines 460-765
// ============================================================
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Line, LineChart } from 'recharts';
import { Wifi, Eye, Clock, TrendingUp, Users, FileText, UserPlus, Layers, RefreshCw } from 'lucide-react';
import { useAdminMetrics } from './hooks/useAdminMetrics';
import { planBadge, dauChartConfig, signupsChartConfig, proposalsChartConfig, valueChartConfig, formatShortDate, formatMZNShort, timeAgo, initials } from './constants';
import type { PlanTier } from '@/types/admin';

export function MetricsTab({ activeTab }: { activeTab: string }) {
  const {
    metrics, onlineUsers, dauData, signupData, proposalDayData,
    mostActive, loading, summary24h, refresh,
  } = useAdminMetrics(activeTab, true);

  const planDistribution = { free: 0, pro: 0, business: 0 }; // placeholder — real comes from UsersTab

  if (loading && !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-4 bg-muted rounded animate-pulse" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Secondary KPIs */}
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
              <span className={`px-2 py-1 rounded border ${planBadge.free}`}>Free</span>
              <span className={`px-2 py-1 rounded border ${planBadge.pro}`}>Pro</span>
              <span className={`px-2 py-1 rounded border ${planBadge.business}`}>Biz</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 24h Summary */}
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

      {/* Online Users List */}
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
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${planBadge[u.plano as PlanTier] ?? planBadge.free}`]}>
                    {u.plano.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Utilizadores Activos por Dia</CardTitle>
            <p className="text-xs text-muted-foreground">Últimos 30 dias — utilizadores únicos por dia</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dauChartConfig} className="h-[250px] w-full">
              <BarChart data={dauData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} axisLine={false} interval="preserveStartEnd" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-users)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Evolução de Registos</CardTitle>
            <p className="text-xs text-muted-foreground">Últimos 30 dias — total acumulado</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={signupsChartConfig} className="h-[250px] w-full">
              <LineChart data={signupData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} axisLine={false} interval="preserveStartEnd" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Proposals Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Propostas Criadas por Dia</CardTitle>
          <p className="text-xs text-muted-foreground">Últimos 30 dias — quantidade e valor</p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ ...proposalsChartConfig, ...valueChartConfig }} className="h-[250px] w-full">
            <BarChart data={proposalDayData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} axisLine={false} interval="preserveStartEnd" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Most Active Users */}
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
    </div>
  );
}
