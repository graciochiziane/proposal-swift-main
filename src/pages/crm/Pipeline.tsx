// ============================================================
// Pipeline — Visualização Kanban de oportunidades
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import { CrmService, type PipelineOpportunity, type CrmEstado } from '@/services/crmService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMZN } from '@/services/propostaService';

const PIPELINE_STAGES: { estado: CrmEstado; label: string; color: string; bg: string }[] = [
  { estado: 'novo', label: 'Novos', color: 'text-blue-600', bg: 'bg-blue-50' },
  { estado: 'contactado', label: 'Contactados', color: 'text-purple-600', bg: 'bg-purple-50' },
  { estado: 'qualificado', label: 'Qualificados', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { estado: 'proposta_enviada', label: 'Proposta Enviada', color: 'text-amber-600', bg: 'bg-amber-50' },
  { estado: 'em_negociacao', label: 'Negociação', color: 'text-orange-600', bg: 'bg-orange-50' },
];

export default function Pipeline() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<PipelineOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPipeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await CrmService.getPipeline();
      setOpportunities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPipeline(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadPipeline}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  // Group by stage
  const byStage = (stage: CrmEstado) => opportunities.filter(o => o.estado_comercial === stage);
  const totalValue = opportunities.reduce((sum, o) => sum + o.valor_potencial, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {opportunities.length} oportunidade{opportunities.length !== 1 ? 's' : ''} · {formatMZN(totalValue)} em total
          </p>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Sem oportunidades no pipeline</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Quando transformar um contacto numa oportunidade, poderá acompanhar aqui o seu progresso comercial.
            </p>
            <Button onClick={() => navigate('/crm/contactos')} variant="outline">Ver contactos</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: Kanban horizontal */}
          <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map(stage => {
              const items = byStage(stage.estado);
              const stageValue = items.reduce((sum, o) => sum + o.valor_potencial, 0);
              return (
                <div key={stage.estado} className={`flex-shrink-0 w-72 ${stage.bg} rounded-xl p-3`}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className={`font-semibold text-sm ${stage.color}`}>{stage.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3 px-1">{formatMZN(stageValue)}</div>
                  <div className="space-y-2">
                    {items.map(opp => (
                      <Card
                        key={opp.client_id}
                        className="bg-background cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => navigate(`/crm/contactos/${opp.client_id}`)}
                      >
                        <CardContent className="p-3">
                          <div className="font-medium text-sm truncate">{opp.nome}</div>
                          {opp.empresa && <div className="text-xs text-muted-foreground truncate">{opp.empresa}</div>}
                          {opp.valor_potencial > 0 && (
                            <div className="text-sm font-semibold text-emerald-600 mt-1">{formatMZN(opp.valor_potencial)}</div>
                          )}
                          {opp.proposta_count > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">{opp.proposta_count} proposta{opp.proposta_count !== 1 ? 's' : ''}</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {items.length === 0 && (
                      <div className="text-xs text-muted-foreground/50 text-center py-4">Vazio</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: vertical scroll */}
          <div className="md:hidden space-y-4">
            {PIPELINE_STAGES.map(stage => {
              const items = byStage(stage.estado);
              if (items.length === 0) return null;
              return (
                <div key={stage.estado}>
                  <div className={`flex items-center justify-between mb-2 px-1`}>
                    <h3 className={`font-semibold text-sm ${stage.color}`}>{stage.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(opp => (
                      <Card key={opp.client_id} className="cursor-pointer" onClick={() => navigate(`/crm/contactos/${opp.client_id}`)}>
                        <CardContent className="p-3">
                          <div className="font-medium text-sm">{opp.nome}</div>
                          {opp.empresa && <div className="text-xs text-muted-foreground">{opp.empresa}</div>}
                          {opp.valor_potencial > 0 && (
                            <div className="text-sm font-semibold text-emerald-600 mt-1">{formatMZN(opp.valor_potencial)}</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
