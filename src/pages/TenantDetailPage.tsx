import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getTenant, getTenantMembers, toggleSuspend, updateTenant, getAuditLog, getIaConsumption } from '@/services/adminService';
import type { TenantDetail, TenantMember, AuditLogEntry, PlanTier } from '@/types/admin';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Save, Ban, CheckCircle, AlertTriangle, Brain } from 'lucide-react';

const iaChartConfig: ChartConfig = { count: { label: 'Gerações IA', color: 'hsl(var(--chart-2))' } };

const planBadge: Record<string, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  pro: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  business: 'bg-primary/15 text-primary border-primary/30',
};

function healthColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'audit'>('overview');

  // Data
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [iaData, setIaData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form
  const [editNome, setEditNome] = useState('');
  const [editPlano, setEditPlano] = useState<PlanTier>('free');
  const [editPrice, setEditPrice] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Check admin
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      setIsAdmin(!!data?.some(r => r.role === 'admin'));
      setChecking(false);
    })();
  }, [user]);

  // Load data
  useEffect(() => {
    if (!isAdmin || !id) return;
    (async () => {
      setLoading(true);
      try {
        const [t, m, ia] = await Promise.all([
          getTenant(id),
          getTenantMembers(id),
          getIaConsumption(id, 30),
        ]);
        if (t) {
          setTenant(t);
          setEditNome(t.nome);
          setEditPlano(t.plano);
          setEditPrice(String(t.monthly_price));
          setEditNotes(t.notes ?? '');
        }
        setMembers(m);
        setIaData(ia);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar tenant');
      }
      setLoading(false);
    })();
  }, [isAdmin, id]);

  // Load audit logs for this tenant
  useEffect(() => {
    if (!isAdmin || !id || activeTab !== 'audit') return;
    (async () => {
      try {
        const logs = await getAuditLog();
        setAuditLogs(logs.filter(l => l.target_id === id));
      } catch { /* ignore */ }
    })();
  }, [isAdmin, id, activeTab]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateTenant(id, {
        nome: editNome,
        plano: editPlano,
        monthly_price: parseFloat(editPrice) || 0,
        notes: editNotes,
      });
      toast.success('Tenant actualizado');
      const t = await getTenant(id);
      if (t) setTenant(t);
    } catch { toast.error('Erro ao actualizar'); }
    setSaving(false);
  };

  const handleToggleSuspend = async () => {
    if (!id || !tenant) return;
    const willSuspend = !tenant.suspended_at;
    if (willSuspend && !suspendReason.trim()) {
      toast.error('Indique o motivo da suspensão');
      return;
    }
    try {
      await toggleSuspend(id, willSuspend, suspendReason);
      toast.success(willSuspend ? 'Tenant suspenso' : 'Tenant reactivado');
      setSuspendReason('');
      const t = await getTenant(id);
      if (t) setTenant(t);
    } catch { toast.error('Erro ao alterar estado'); }
  };

  if (checking || loading) return <div className="p-8 text-muted-foreground">A carregar...</div>;
  if (!isAdmin) return <div className="p-8 text-destructive">Acesso negado</div>;
  if (!tenant) return <div className="p-8 text-muted-foreground">Tenant não encontrado</div>;

  const initials = (name: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const shortDate = (d: string) => new Date(d).toLocaleDateString('pt-PT');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tenant.nome}</h1>
          <p className="text-sm text-muted-foreground">Criado em {shortDate(tenant.created_at)} · {tenant.slug}</p>
        </div>
        {tenant.suspended_at ? (
          <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Suspenso</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3" /> Activo</Badge>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        {(['overview', 'members', 'audit'] as const).map(tab => (
          <Button key={tab} variant={activeTab === tab ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveTab(tab)}>
            {{ overview: 'Visão Geral', members: 'Membros', audit: 'Auditoria' }[tab]}
          </Button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saúde</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${healthColor(tenant.health_score)}`}>{tenant.health_score}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Membros</CardTitle>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{tenant.member_count}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Propostas (mês)</CardTitle>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{tenant.propostas_mes_count}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gerações IA (mês)</CardTitle>
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{tenant.geracoes_ia_mes_count}</div></CardContent>
            </Card>
          </div>

          {/* IA BarChart — Fase 5.1 */}
          {iaData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Consumo IA — Últimos 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={iaChartConfig} className="h-[250px] w-full">
                  <BarChart data={iaData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Edit form + Suspend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Editar Tenant</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Plano</label>
                  <select className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                    value={editPlano} onChange={e => setEditPlano(e.target.value as PlanTier)}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Preço Mensal (MT)</label>
                  <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas</label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                  <Save className="h-4 w-4" /> Guardar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Suspender / Reactivar</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {tenant.suspended_at && (
                  <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                    <p className="text-sm font-medium text-destructive">Suspenso em {new Date(tenant.suspended_at).toLocaleString('pt-PT')}</p>
                    {tenant.suspension_reason && <p className="text-xs text-muted-foreground">Motivo: {tenant.suspension_reason}</p>}
                  </div>
                )}
                {!tenant.suspended_at && (
                  <div>
                    <label className="text-xs text-muted-foreground">Motivo da suspensão</label>
                    <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={2}
                      placeholder="Indique o motivo..." />
                  </div>
                )}
                <Button
                  variant={tenant.suspended_at ? 'default' : 'destructive'}
                  onClick={handleToggleSuspend}
                  className="w-full gap-2"
                >
                  {tenant.suspended_at ? (<><CheckCircle className="h-4 w-4" /> Reactivar</>) : (<><Ban className="h-4 w-4" /> Suspender</>)}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: Members */}
      {activeTab === 'members' && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Membros ({members.length})</CardTitle></CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem membros</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Entrou em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="flex items-center gap-2">
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials(m.profiles?.nome ?? null)}</AvatarFallback></Avatar>
                        {m.profiles?.nome || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.profiles?.email}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.role === 'owner' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                          {m.role.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{shortDate(m.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Audit */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Auditoria do Tenant</CardTitle></CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem registos de auditoria</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Acção</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('pt-PT')}</TableCell>
                      <TableCell className="font-medium">{l.action}</TableCell>
                      <TableCell className="text-muted-foreground">{l.admin_email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {l.target_snapshot ? JSON.stringify(l.target_snapshot) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
