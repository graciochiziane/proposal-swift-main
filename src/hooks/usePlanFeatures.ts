// ============================================================
// usePlanFeatures — Hook para verificar features por plano
//
// Permite que o frontend verifique que features estão activas
// para o plano da organização actual do utilizador.
//
// Usa cache em memória para evitar queries repetidas.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type PlanTier = Database['public']['Enums']['plan_tier'];

export interface PlanFeature {
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;  // null = ilimitado
}

/**
 * Hook que retorna as features do plano da organização actual.
 *
 * Uso:
 *   const { hasFeature, getFeatureLimit, features, loading } = usePlanFeatures();
 *   if (hasFeature('advanced_proposals')) { ... }
 *
 * Cache:
 *   - Features são carregadas uma vez por organização
 *   - Recarrega quando a organização activa muda
 */
export function usePlanFeatures() {
  const { organization } = useAuth();
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeatures = useCallback(async (plano: PlanTier) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_plan_features', { p_plano: plano });

      if (error) {
        console.error('[usePlanFeatures] Erro ao carregar features:', error);
        setFeatures([]);
      } else {
        setFeatures((data ?? []) as PlanFeature[]);
      }
    } catch (err) {
      console.error('[usePlanFeatures] Exception:', err);
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (organization?.plano) {
      loadFeatures(organization.plano);
    } else {
      setFeatures([]);
      setLoading(false);
    }
  }, [organization?.plano, loadFeatures]);

  /**
   * Verifica se uma feature está activa para o plano actual.
   * Retorna false se a feature não existir ou estiver desactivada.
   */
  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      const f = features.find(x => x.feature_key === featureKey);
      return f?.enabled ?? false;
    },
    [features]
  );

  /**
   * Retorna o limite de uma feature para o plano actual.
   * Retorna null se:
   *   - A feature não existir
   *   - A feature estiver desactivada
   *   - O limite for ilimitado (NULL na BD)
   */
  const getFeatureLimit = useCallback(
    (featureKey: string): number | null => {
      const f = features.find(x => x.feature_key === featureKey);
      if (!f?.enabled) return null;
      return f.limit_value;
    },
    [features]
  );

  return {
    features,
    loading,
    hasFeature,
    getFeatureLimit,
    reload: () => organization?.plano && loadFeatures(organization.plano),
  };
}
