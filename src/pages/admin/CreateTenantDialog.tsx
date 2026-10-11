// ============================================================
// CreateTenantDialog — with client-side validation (FIX 3.5)
// ============================================================
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { CreateTenantData, PlanTier } from '@/types/admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  nome?: string;
  email?: string;
  nuit?: string;
}

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
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset errors when dialog opens
  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!newTenant.nome || newTenant.nome.trim().length < 2) {
      e.nome = 'Nome obrigatório (mín. 2 caracteres)';
    }
    if (!newTenant.email || !EMAIL_RE.test(newTenant.email)) {
      e.email = 'Email inválido';
    }
    if (newTenant.nuit && !/^\d+$/.test(newTenant.nuit.trim())) {
      e.nuit = 'NUIT deve conter apenas dígitos';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Tenant</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={newTenant.nome} onChange={e => setNewTenant(p => ({ ...p, nome: e.target.value }))} />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email de contacto</label>
            <Input type="email" value={newTenant.email} onChange={e => setNewTenant(p => ({ ...p, email: e.target.value }))} />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">NUIT</label>
            <Input value={newTenant.nuit || ''} onChange={e => setNewTenant(p => ({ ...p, nuit: e.target.value }))} placeholder="Opcional" />
            {errors.nuit && <p className="text-xs text-destructive mt-1">{errors.nuit}</p>}
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
          <Button onClick={handleSubmit} disabled={creating} className="w-full">{creating ? 'A criar...' : 'Criar Tenant'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
