// ============================================================
// TenantsTab — Tenant listing, search, sort, IA alert
// Extracted from Admin.tsx lines 924-1027
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ArrowUpDown, Plus, Layers, AlertTriangle, Building2, Sparkles } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminTenants } from './hooks/useAdminTenants';
import { planBadge } from './constants';
import { PlanLimitsDialog } from './PlanLimitsDialog';
import { PlanFeaturesDialog } from './PlanFeaturesDialog';
import { CreateTenantDialog } from './CreateTenantDialog';

export function TenantsTab() {
  const navigate = useNavigate();
  const [showPlanFeatures, setShowPlanFeatures] = useState(false);
  const {
    loading, tenantSearch, setTenantSearch,
    showIaAlert, setShowIaAlert, tenantSort, setTenantSort,
    filteredTenants, tenants,
    showCreateTenant, setShowCreateTenant,
    showPlanLimits, setShowPlanLimits,
    newTenant, setNewTenant, creating, handleCreateTenant,
  } = useAdminTenants(true);

  return (
    <div className="space-y-6">
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
              <Button variant="outline" size="sm" onClick={() => setShowPlanFeatures(true)} className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Features
              </Button>
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
                      <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-MZ')}</TableCell>
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

      {/* Dialogs */}
      <CreateTenantDialog
        open={showCreateTenant}
        onOpenChange={setShowCreateTenant}
        newTenant={newTenant}
        setNewTenant={setNewTenant}
        creating={creating}
        onSubmit={handleCreateTenant}
      />
      <PlanLimitsDialog open={showPlanLimits} onOpenChange={setShowPlanLimits} />
      <PlanFeaturesDialog open={showPlanFeatures} onOpenChange={setShowPlanFeatures} />
    </div>
  );
}
