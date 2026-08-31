// ============================================================
// PlanLimitsDialog — extracted from Admin.tsx lines 1118-1177
// FIX 3.4: now audits plan limit changes
// ============================================================
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PlanRow {
  plano: PlanTier;
  propostas_mes: number;
  geracoes_ia_mes: number;
  clientes_max: number | null;
}

type PlanTier = 'free' | 'pro' | 'business';

export function PlanLimitsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from('plan_limits').select('*').then(({ data }) => setPlans((data ?? []) as PlanRow[]));
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const adminId = (await supabase.auth.getUser()).data.user?.id;

    for (const p of plans) {
      const before = { ...p };
      await supabase.from('plan_limits').update({
        propostas_mes: p.propostas_mes,
        geracoes_ia_mes: p.geracoes_ia_mes,
        clientes_max: p.clientes_max,
      }).eq('plano', p.plano);

      // FIX 3.4: Audit each plan limit change (não-bloqueante)
      if (adminId) {
        try {
          await supabase.from('admin_audit_log').insert({
            admin_id: adminId,
            action: 'plan_limits_update',
            target_table: 'plan_limits',
            // plan_limits é identificada pela PK plano (target_id NOT NULL)
            target_id: p.plano,
            target_snapshot: { plano: p.plano, before, after: { propostas_mes: p.propostas_mes, geracoes_ia_mes: p.geracoes_ia_mes, clientes_max: p.clientes_max } },
          });
        } catch { /* non-blocking */ }
      }
    }

    toast.success('Planos actualizados');
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Gestão de Planos</DialogTitle></DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
