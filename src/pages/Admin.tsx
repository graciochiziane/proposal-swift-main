import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { MoreHorizontal, Search, Users, FileText, UserCheck, Layers } from 'lucide-react';

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

const planBadge: Record<PlanTier, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  pro: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  business: 'bg-primary/15 text-primary border-primary/30',
};

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [proposalsCount, setProposalsCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, proposalsRes, clientsRes] = await Promise.all([
      supabase.from('profiles').select('id, email, nome, plano, propostas_mes_count, created_at').order('created_at', { ascending: false }),
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
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

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
    toast.success(`Plano de ${u.email} → ${plano}`);
    loadData();
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

  if (authLoading || checkingRole) {
    return <div className="p-8 text-muted-foreground">A verificar permissões...</div>;
  }

  if (!isAdmin) {
    toast.error('Acesso negado: área restrita a administradores');
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel SuperAdmin</h1>
        <p className="text-sm text-muted-foreground">Gestão global de utilizadores e métricas da plataforma</p>
      </div>

      {/* Métricas */}
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

      {/* Tabela */}
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
          {loading ? (
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
    </div>
  );
}
