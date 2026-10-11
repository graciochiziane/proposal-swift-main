// ============================================================
// AuditTab — Audit log table with server-side filters
// Extracted from Admin.tsx lines 1032-1084
// FIX 0.3: target_id filter moved to server (in useAdminAudit)
// ============================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminAudit } from './hooks/useAdminAudit';
import type { Tenant } from '@/types/admin';

export function AuditTab({ tenants }: { tenants: Tenant[] }) {
  const {
    auditLogs, loading, loadAuditData,
    auditActionFilter, setAuditActionFilter,
    auditTenantFilter, setAuditTenantFilter,
    auditDateFrom, setAuditDateFrom,
    auditDateTo, setAuditDateTo,
  } = useAdminAudit(true);

  return (
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
        {loading ? (
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
                {auditLogs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-MZ')}</TableCell>
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
  );
}
