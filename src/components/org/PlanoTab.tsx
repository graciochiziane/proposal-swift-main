import { useAuth } from '@/hooks/useAuth';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { Check, X, CalendarDays, Hash, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// Rótulos amigáveis das feature_keys conhecidas (plan_features)
const FEATURE_LABELS: Record<string, string> = {
  advanced_proposals: 'Propostas Avançadas (blueprint + IA)',
  custom_branding: 'Personalização de marca',
  multi_user: 'Multi-utilizador / Equipa',
  api_access: 'Acesso à API pública',
  pdf_export: 'Exportação de PDF',
  crm_access: 'CRM / Vendas',
};

const PLANOS: Record<string, { label: string; desc: string }> = {
  free: { label: 'Free', desc: 'Plano de partida para profissionais individuais.' },
  pro: { label: 'Pro', desc: 'Para equipas que precisam de marca própria e mais volume.' },
  business: { label: 'Business', desc: 'Operação completa com CRM e multi-utilizador.' },
};

/**
 * Aba 4 — Plano & Faturação (apenas leitura).
 * Plano actual, data de adesão, utilização do mês e features activas.
 */
export default function PlanoTab() {
  const { organization } = useAuth();
  const { features, loading } = usePlanFeatures();

  if (!organization) return null;

  const planoInfo = PLANOS[organization.plano] ?? { label: organization.plano, desc: '' };
  const fmtData = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-MZ', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-4">
      {/* ── Plano actual ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano &amp; Faturação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="text-sm px-3 py-1">{planoInfo.label}</Badge>
            <span className="text-sm text-muted-foreground">{planoInfo.desc}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <Label className="text-xs text-muted-foreground">Membro desde</Label>
                <p className="text-sm">{fmtData(organization.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <Label className="text-xs text-muted-foreground">Identificador</Label>
                <p className="text-sm font-mono">{organization.slug}</p>
              </div>
            </div>
          </div>

          {/* ── Utilização do mês ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <Label className="text-xs text-muted-foreground">Propostas este mês</Label>
                <p className="text-sm font-semibold">{organization.propostas_mes_count}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <Label className="text-xs text-muted-foreground">Gerações IA este mês</Label>
                <p className="text-sm font-semibold">{organization.geracoes_ia_mes_count}</p>
              </div>
            </div>
          </div>

          {/* ── Features do plano ── */}
          <div className="pt-4 border-t">
            <Label className="text-xs text-muted-foreground mb-3 block">Incluído no seu plano</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">A carregar…</p>
            ) : (
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f.feature_key} className="flex items-center gap-3 text-sm">
                    {f.enabled ? (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    )}
                    <span className={f.enabled ? '' : 'text-muted-foreground/60 line-through'}>
                      {FEATURE_LABELS[f.feature_key] ?? f.feature_key}
                    </span>
                    {f.enabled && f.limit_value !== null && (
                      <span className="ml-auto text-xs text-muted-foreground">até {f.limit_value}</span>
                    )}
                    {f.enabled && f.limit_value === null && (
                      <span className="ml-auto text-xs text-muted-foreground">ilimitado</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            Para alterar o seu plano, fale com a equipa PropostaJá. A facturação é processada
            pela plataforma; os dados acima são apenas informativos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
