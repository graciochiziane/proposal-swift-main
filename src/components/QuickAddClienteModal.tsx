// ============================================================
// QuickAddClienteModal — Modal de Criação Rápida de Cliente
//
// Permite criar um cliente completo sem sair da página de proposta.
// Campos: Nome/Razão Social, NUIT, Telefone, Email, Endereço, Empresa
// Validação básica (nome obrigatório).
// Auto-selecciona o novo cliente após criar.
// ============================================================

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';
import { ClienteService } from '@/services/clienteService';
import type { Cliente } from '@/types';
import { toast } from 'sonner';

interface QuickAddClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback chamado após criar o cliente com sucesso. */
  onClienteCreated: (cliente: Cliente) => void;
}

interface FormState {
  nome: string;
  empresa: string;
  nuit: string;
  telefone: string;
  email: string;
  endereco: string;
}

const EMPTY_FORM: FormState = {
  nome: '',
  empresa: '',
  nuit: '',
  telefone: '',
  email: '',
  endereco: '',
};

export function QuickAddClienteModal({
  open,
  onOpenChange,
  onClienteCreated,
}: QuickAddClienteModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Reset form quando o modal fecha
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSaving(false);
    }
  }, [open]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    // Validar email se preenchido
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email inválido';
    }

    // Validar NUIT se preenchido (apenas dígitos)
    if (form.nuit && !/^\d+$/.test(form.nuit.trim())) {
      newErrors.nuit = 'NUIT deve conter apenas dígitos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando user começa a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const novo = await ClienteService.criarCliente({
        nome: form.nome.trim(),
        empresa: form.empresa.trim(),
        nuit: form.nuit.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        endereco: form.endereco.trim(),
      });

      toast.success(`Cliente "${novo.nome}" criado com sucesso`);
      onClienteCreated(novo);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar cliente';
      toast.error(msg);
      console.error('[QuickAddClienteModal] Erro:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter não submete em campos de texto multilinha, mas submete nos outros
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Novo Cliente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do cliente. Os campos marcados com * são obrigatórios.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nome * */}
          <div className="space-y-1.5">
            <Label htmlFor="nome">
              Nome / Razão Social <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={e => handleFieldChange('nome', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: João Silva ou Empresa ABC, Lda."
              autoFocus
              disabled={saving}
            />
            {errors.nome && (
              <p className="text-xs text-red-500">{errors.nome}</p>
            )}
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <Label htmlFor="empresa">Empresa</Label>
            <Input
              id="empresa"
              value={form.empresa}
              onChange={e => handleFieldChange('empresa', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nome da empresa (opcional)"
              disabled={saving}
            />
          </div>

          {/* NUIT + Telefone (grid 2 colunas) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nuit">NUIT</Label>
              <Input
                id="nuit"
                value={form.nuit}
                onChange={e => handleFieldChange('nuit', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Apenas dígitos"
                inputMode="numeric"
                disabled={saving}
              />
              {errors.nuit && (
                <p className="text-xs text-red-500">{errors.nuit}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={e => handleFieldChange('telefone', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 84 123 4567"
                disabled={saving}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => handleFieldChange('email', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="cliente@email.com"
              disabled={saving}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Endereço */}
          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={form.endereco}
              onChange={e => handleFieldChange('endereco', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rua, número, bairro, cidade"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.nome.trim()}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Salvar Cliente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
