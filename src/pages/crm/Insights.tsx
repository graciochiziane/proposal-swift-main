// ============================================================
// Insights — Inteligência comercial baseada em dados reais
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Lightbulb, TrendingUp, BellRing, DollarSign, Clock } from 'lucide-react';
import { CrmService, type CRMInsights } from '@/services/crmService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMZN } from '@/services/propostaService';

export default function Insights() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<CRMInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await CrmService.getInsights();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInsights(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !insights) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error || 'Sem dados'}</p>
          <Button variant="outline" size="sm" onClick={loadInsights}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  // Generate insights from data
  const insightCards: { icon: typeof TrendingUp; color: string; bg: string; title: string; value: string; description: string; action?: () => void }[] = [];

  if (insights.followups_pendentes > 0) {
    insightCards.push({
      icon: BellRing, color: 'text-red-600', bg: 'bg-red-100',
      title: 'Follow-ups vencidos',
      value: insights.followups_pendentes.toString(),
      description: 'Existem follow-ups que ultrapassaram a data prevista. Contacte os clientes para não perder oportunidades.',
      action: () => navigate('/crm/follow-ups'),
    });
  }

  if (insights.propostas_pendentes > 0) {
    insightCards.push({
      icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100',
      title: 'Propostas pendentes',
      value: insights.propostas_pendentes.toString(),
      description: 'Existem propostas enviadas que ainda aguardam decisão. Considere fazer follow-up.',
      action: () => navigate('/propostas'),
    });
  }

  if (insights.valor_pipeline > 0) {
    insightCards.push({
      icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100',
      title: 'Valor em pipeline',
      value: formatMZN(insights.valor_pipeline),
      description: 'Valor potencial das oportunidades actualmente em negociação.',
      action: () => navigate('/crm/pipeline'),
    });
  }

  if (insights.leads_ativos > 0) {
    insightCards.push({
      icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100',
      title: 'Leads activos',
      value: insights.leads_ativos.toString(),
      description: 'Número de contactos em processo comercial activo.',
      action: () => navigate('/crm/contactos'),
    });
  }

  if (insights.taxa_conversao > 0) {
    insightCards.push({
      icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100',
      title: 'Taxa de conversão',
      value: `${insights.taxa_conversao}%`,
      description: 'Percentagem de oportunidades convertidas em negócio ganho.',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">Inteligência comercial baseada nos seus dados</p>
      </div>

      {insightCards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Lightbulb className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Sem insights disponíveis</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Comece a usar o CRM para gerar dados. À medida que regista actividades, propostas e follow-ups,
              insights aparecerão aqui automaticamente.
            </p>
            <Button onClick={() => navigate('/crm/contactos')} variant="outline">Ver contactos</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insightCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card
                key={i}
                className={card.action ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}
                onClick={card.action}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${card.bg} shrink-0`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-2xl font-bold">{card.value}</div>
                      <div className="font-medium text-sm">{card.title}</div>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
