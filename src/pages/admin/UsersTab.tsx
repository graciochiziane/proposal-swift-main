// ============================================================
// UsersTab — User management table with plan/role actions
// Extracted from Admin.tsx lines 770-919
// FIX 3.1: now shows last_seen_at column
// ============================================================
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Users, FileText, UserCheck, Layers, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminUsers } from './hooks/useAdminUsers';
import { planBadge, timeAgo } from './constants';

export function UsersTab() {
  const { user } = useAuth();
  const {
    filtered, loading, search, setSearch,
    proposalsCount, clientsCount, planDistribution,
    changePlan, toggleAdmin, resetCounter,
  } = useAdminUsers(true);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilizadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Propostas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{proposalsCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{clientsCount}</div></CardContent>
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
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${planBadge[u.plano]}`}>{u.plano.toUpperCase()}</span>
                        </TableCell>
                        <TableCell>
                          {isUserAdmin ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-accent/15 text-accent border-accent/30">ADMIN</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">user</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{u.propostas_mes_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-PT')}</TableCell>
                        {/* FIX 3.1: now renders last_seen_at */}
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(u.last_seen_at)}</TableCell>
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
                              <DropdownMenuItem onClick={() => toggleAdmin(u)} disabled={u.id === user?.id}>
                                {isUserAdmin ? 'Remover admin' : 'Promover a admin'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => resetCounter(u)}>Reset contador propostas</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum utilizador encontrado</TableCell>
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
