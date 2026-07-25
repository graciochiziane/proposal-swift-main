// ============================================================
// CreateTenantDialog — extracted from Admin.tsx lines 1087-1115
// ============================================================
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { CreateTenantData, PlanTier } from '@/types/admin';

export function CreateTenantDialog({
  open, onOpenChange, newTenant, setNewTenant, creating, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newTenant: CreateTenantData;
  setNewTenant: React.Dispatch<React.SetStateAction<CreateTenantData>>;
  creating: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button onClick={onSubmit} disabled={creating} className="w-full">{creating ? 'A criar...' : 'Criar Tenant'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
