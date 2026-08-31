// ============================================================
// CRM Dashboard — Visão geral comercial com tabs internas
//
// Reescrito para ser o hub central do CRM com navegação:
// - Visão geral (KPIs reais)
// - Pipeline (Kanban)
// - Follow-ups (pendentes)
// - Actividades (timeline)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, DollarSign, FileText, BellRing,
  Target, ArrowRight, Loader2, AlertCircle, Plus,
} from 'lucide-react';
import { CrmService, type CRMInsights, type CrmFollowUp } from '@/services/crmService';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMZN } from '@/services/propostaService';

export default function CRMDashboard() {
  const navigate = useNavigate();
  const { hasFeature } = usePlanFeatures();
  const canAccess = hasFeature('crm_access');

  const [insights, setInsights] = useState<CRMInsights | null>(null);
  const [followUps, setFollowUps] = useState<CrmFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [insightsData, followUpsData] = await Promise.all([
        CrmService.getInsights(),
        CrmService.getFollowUps('all'),
      ]);
      setInsights(insightsData);
      setFollowUps(followUpsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) loadData();
  }, [canAccess]);

  // Feature gate
  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10 mx-auto w-fit">
              <TrendingUp className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Vendas exclusiva do plano Business</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Transforme os seus contactos em oportunidades de venda. Acompanhe propostas,
              follow-ups, oportunidades e histórico comercial num só lugar.
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

  if (error || !insights) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error || 'Sem dados'}</p>
          <Button variant="outline" size="sm" onClick={loadData}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const pendingFollowUps = followUps.filter(f => !f.completed_at);
  const overdueFollowUps = pendingFollowUps.filter(f => new Date(f.due_at) < new Date());

  // KPIs reais (zeros se não houver dados)
  const kpis = [
    { label: 'Clientes', value: insights.total_clientes, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', action: () => navigate('/crm/contactos') },
    { label: 'Leads Activos', value: insights.leads_ativos, icon: Target, color: 'text-purple-600', bg: 'bg-purple-100', action: () => navigate('/crm/contactos') },
    { label: 'Negócios em Aberto', value: insights.negocios_abertos, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100', action: () => navigate('/crm/pipeline') },
    { label: 'Valor em Pipeline', value: formatMZN(insights.valor_pipeline), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100', action: () => navigate('/crm/pipeline') },
    { label: 'Propostas Pendentes', value: insights.propostas_pendentes, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100', action: () => navigate('/propostas') },
    { label: 'Follow-ups Vencidos', value: insights.followups_pendentes, icon: BellRing, color: 'text-red-600', bg: 'bg-red-100', action: () => navigate('/crm/follow-ups') },
    { label: 'Taxa de Conversão', value: `${insights.taxa_conversao}%`, icon: Target, color: 'text-green-600', bg: 'bg-green-100', action: undefined },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Vendas</h1>
        <p className="text-sm text-muted-foreground">Visão geral comercial da sua organização</p>
      </div>

      {/* KPIs — zeros se não houver dados */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.label}
              className={kpi.action ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}
              onClick={kpi.action}
            >
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="text-sm text-muted-foreground">
                {pendingFollowUps.length} pendente{pendingFollowUps.length !== 1 ? 's' : ''}
                {overdueFollowUps.length > 0 && (
                  <span className="text-red-600 font-medium"> · {overdueFollowUps.length} vencido{overdueFollowUps.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Empty state — quando não há dados */}
      {insights.total_clientes === 0 && (
        <Card>
          <CardContent className="p-8 md:p-12 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Comece a usar o CRM</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Ainda não existem oportunidades comerciais. Adicione contactos e transforme-os
                em oportunidades para acompanhar o seu pipeline de vendas.
              </p>
            </div>
            <Button onClick={() => navigate('/clientes')} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar contacto
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
