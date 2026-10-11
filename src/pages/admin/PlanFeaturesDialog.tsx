// ============================================================
// PlanFeaturesDialog — Super Admin UI for managing plan_features
//
// Allows platform admins to:
//   - Toggle features on/off per plan
//   - Set limit_value per feature (NULL = unlimited)
//   - Add new features
//   - Remove features
//
// Uses RPC upsert_plan_feature (SECURITY DEFINER, admin only).
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type PlanTier = 'free' | 'pro' | 'business';

interface PlanFeatureRow {
  plano: PlanTier;
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
}

const PLANS: PlanTier[] = ['free', 'pro', 'business'];

export function PlanFeaturesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [features, setFeatures] = useState<PlanFeatureRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFeatureKey, setNewFeatureKey] = useState('');

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plan_features')
        .select('*')
        .order('feature_key, plano');

      if (error) throw error;
      setFeatures((data ?? []) as PlanFeatureRow[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao carregar features: ' + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadFeatures();
  }, [open, loadFeatures]);

  // Group features by feature_key for UI
  const featureKeys = Array.from(new Set(features.map(f => f.feature_key))).sort();

  const getFeatureForPlan = (key: string, plan: PlanTier): PlanFeatureRow | undefined => {
    return features.find(f => f.feature_key === key && f.plano === plan);
  };

  const handleToggle = async (key: string, plan: PlanTier, enabled: boolean) => {
    const existing = getFeatureForPlan(key, plan);
    const limitValue = existing?.limit_value ?? null;

    // Optimistic update
    setFeatures(prev => {
      const idx = prev.findIndex(f => f.feature_key === key && f.plano === plan);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], enabled };
        return next;
      }
      return [...prev, { plano: plan, feature_key: key, enabled, limit_value: null }];
    });

    try {
      const { error } = await supabase.rpc('upsert_plan_feature', {
        p_plano: plan,
        p_feature_key: key,
        p_enabled: enabled,
        p_limit_value: limitValue ?? undefined,
      });
      if (error) throw error;
      toast.success(`${key} ${enabled ? 'activado' : 'desactivado'} para ${plan}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      toast.error('Erro: ' + msg);
      loadFeatures(); // revert on error
    }
  };

  const handleLimitChange = async (key: string, plan: PlanTier, limitStr: string) => {
    const limitValue = limitStr === '' ? null : Number(limitStr);
    if (limitValue !== null && Number.isNaN(limitValue)) return;

    // Optimistic update
    setFeatures(prev => {
      const idx = prev.findIndex(f => f.feature_key === key && f.plano === plan);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], limit_value: limitValue };
        return next;
      }
      return [...prev, { plano: plan, feature_key: key, enabled: false, limit_value: limitValue }];
    });
  };

  const handleLimitBlur = async (key: string, plan: PlanTier, limitStr: string) => {
    const limitValue = limitStr === '' ? null : Number(limitStr);
    const existing = getFeatureForPlan(key, plan);
    if (!existing) return;

    if (existing.limit_value === limitValue) return; // no change

    try {
      const { error } = await supabase.rpc('upsert_plan_feature', {
        p_plano: plan,
        p_feature_key: key,
        p_enabled: existing.enabled,
        p_limit_value: limitValue ?? undefined,
      });
      if (error) throw error;
      toast.success(`Limite de ${key} actualizado para ${plan}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      toast.error('Erro: ' + msg);
      loadFeatures();
    }
  };

  const handleAddFeature = async () => {
    const key = newFeatureKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key || key.length < 3) {
      toast.error('Nome da feature deve ter pelo menos 3 caracteres (a-z, 0-9, _)');
      return;
    }
    if (featureKeys.includes(key)) {
      toast.error('Feature já existe');
      return;
    }

    setSaving(true);
    try {
      // Create feature for all 3 plans (disabled by default)
      for (const plan of PLANS) {
        const { error } = await supabase.rpc('upsert_plan_feature', {
          p_plano: plan,
          p_feature_key: key,
          p_enabled: false,
          // p_limit_value omitido -> DEFAULT NULL no Postgres = ilimitado
          // (o tipo gerado do RPC não aceita null explícito)
        });
        if (error) throw error;
      }
      setNewFeatureKey('');
      toast.success(`Feature '${key}' criada para todos os planos (desactivada)`);
      await loadFeatures();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      toast.error('Erro ao criar feature: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeature = async (key: string) => {
    if (!confirm(`Eliminar a feature '${key}' de todos os planos?`)) return;

    try {
      const { error } = await supabase
        .from('plan_features')
        .delete()
        .eq('feature_key', key);

      if (error) throw error;
      toast.success(`Feature '${key}' eliminada`);
      await loadFeatures();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      toast.error('Erro ao eliminar: ' + msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestão de Features por Plano</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Active ou desactive funcionalidades para cada plano comercial.
            O limite define o máximo (vazio = ilimitado).
          </p>
        </DialogHeader>

        {/* Add new feature */}
        <div className="flex gap-2 items-end py-2 border-b pb-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Nova feature (ex: api_access, custom_branding)
            </label>
            <Input
              value={newFeatureKey}
              onChange={e => setNewFeatureKey(e.target.value)}
              placeholder="nome_da_feature"
              onKeyDown={e => e.key === 'Enter' && handleAddFeature()}
            />
          </div>
          <Button onClick={handleAddFeature} disabled={saving || !newFeatureKey.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : featureKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma feature configurada. Adicione a primeira acima.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Feature</TableHead>
                <TableHead className="text-center">Free</TableHead>
                <TableHead className="text-center">Pro</TableHead>
                <TableHead className="text-center">Business</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureKeys.map(key => (
                <TableRow key={key}>
                  <TableCell className="font-mono text-sm font-medium">{key}</TableCell>
                  {PLANS.map(plan => {
                    const f = getFeatureForPlan(key, plan);
                    return (
                      <TableCell key={plan} className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            checked={f?.enabled ?? false}
                            onCheckedChange={(checked) => handleToggle(key, plan, checked)}
                          />
                          <Input
                            type="number"
                            className="w-16 h-7 text-xs text-center"
                            value={f?.limit_value ?? ''}
                            placeholder="∞"
                            onChange={e => handleLimitChange(key, plan, e.target.value)}
                            onBlur={e => handleLimitBlur(key, plan, e.target.value)}
                            disabled={!f?.enabled}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <button
                      onClick={() => handleDeleteFeature(key)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title="Eliminar feature"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          <p>• Switch = activar/desactivar a feature para o plano</p>
          <p>• Input numérico = limite específico (vazio = ilimitado)</p>
          <p>• Ex: multi_user free=3, pro=10, business=vazio (ilimitado)</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
