// ============================================================
// CRM Dashboard — Visão geral comercial
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, DollarSign, FileText, BellRing,
  Target, ArrowRight, Loader2, AlertCircle,
} from 'lucide-react';
import { CrmService, type CRMInsights } from '@/services/crmService';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMZN } from '@/services/propostaService';

export default function CRMDashboard() {
  const navigate = useNavigate();
  const { hasFeature } = usePlanFeatures();
  const [insights, setInsights] = useState<CRMInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess = hasFeature('crm_access');

  useEffect(() => {
    if (!canAccess) return;
    loadInsights();
  }, [canAccess]);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await CrmService.getInsights();
      setInsights(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar métricas';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Feature gate
  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10 mx-auto w-fit">
              <TrendingUp className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold">CRM exclusivo do plano Business</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Transforme os seus contactos em oportunidades de venda. Com o CRM Business
              pode acompanhar propostas, follow-ups, oportunidades e histórico comercial num só lugar.
            </p>
            <Button onClick={() => navigate('/organizacao')} className="gap-2">
              Conhecer Business
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadInsights}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const kpis = [
    { label: 'Clientes', value: insights.total_clientes.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Leads Activos', value: insights.leads_ativos.toString(), icon: Target, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Negócios em Aberto', value: insights.negocios_abertos.toString(), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Valor em Pipeline', value: formatMZN(insights.valor_pipeline), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Propostas Pendentes', value: insights.propostas_pendentes.toString(), icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Follow-ups Vencidos', value: insights.followups_pendentes.toString(), icon: BellRing, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Taxa de Conversão', value: `${insights.taxa_conversao}%`, icon: Target, color: 'text-green-600', bg: 'bg-green-100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">CRM Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral comercial da sua organização</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <div className="text-xl md:text-2xl font-bold">{kpi.value}</div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate('/crm/contactos')}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="font-semibold">Contactos</div>
              <div className="text-sm text-muted-foreground">Gerir contactos e leads</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate('/crm/pipeline')}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="font-semibold">Pipeline</div>
              <div className="text-sm text-muted-foreground">Oportunidades por etapa</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate('/crm/follow-ups')}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="font-semibold">Follow-ups</div>
              <div className="text-sm text-muted-foreground">Próximas acções</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
