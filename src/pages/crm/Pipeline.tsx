// ============================================================
// Pipeline — Kanban comercial rico com dados reais
//
// Reconstruído para mostrar informação comercial completa:
// - Nome/empresa
// - Estado com cor semântica
// - Valor potencial
// - Proposta associada (se houver)
// - Última actividade
// - Próxima acção (follow-up)
// - Tags
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, TrendingUp, Search,
  FileText, Clock, Calendar, ChevronRight,
  Plus, Circle,
} from 'lucide-react';
import { CrmService, type PipelineOpportunity, type CrmEstado } from '@/services/crmService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMZN } from '@/services/propostaService';

const PIPELINE_STAGES: { estado: CrmEstado; label: string; shortLabel: string; color: string; dotColor: string; bg: string }[] = [
  { estado: 'novo',              label: 'Novos',              shortLabel: 'Novo',         color: 'text-slate-600',   dotColor: 'bg-slate-400',   bg: 'bg-slate-50' },
  { estado: 'contactado',        label: 'Contactados',        shortLabel: 'Contactado',   color: 'text-purple-600',  dotColor: 'bg-purple-500',  bg: 'bg-purple-50' },
  { estado: 'qualificado',       label: 'Qualificados',       shortLabel: 'Qualificado',  color: 'text-indigo-600',  dotColor: 'bg-indigo-500',  bg: 'bg-indigo-50' },
  { estado: 'proposta_enviada',  label: 'Proposta Enviada',   shortLabel: 'Proposta',     color: 'text-amber-600',   dotColor: 'bg-amber-500',   bg: 'bg-amber-50' },
  { estado: 'em_negociacao',     label: 'Em Negociação',      shortLabel: 'Negociação',   color: 'text-orange-600',  dotColor: 'bg-orange-500',  bg: 'bg-orange-50' },
  { estado: 'ganho',             label: 'Ganhos',              shortLabel: 'Ganho',        color: 'text-emerald-600', dotColor: 'bg-emerald-500', bg: 'bg-emerald-50' },
  { estado: 'perdido',           label: 'Perdidos',            shortLabel: 'Perdido',      color: 'text-red-600',     dotColor: 'bg-red-500',     bg: 'bg-red-50' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days}d`;
  if (days < 30) return `Há ${Math.floor(days / 7)}sem`;
  return `Há ${Math.floor(days / 30)}mês`;
}

function timeUntil(dateStr: string | null): { label: string; overdue: boolean } {
  if (!dateStr) return { label: '—', overdue: false };
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return { label: `Atrasado há ${Math.abs(days)}d`, overdue: true };
  if (days === 0) return { label: 'Hoje', overdue: false };
  if (days === 1) return { label: 'Amanhã', overdue: false };
  if (days < 7) return { label: `Em ${days}d`, overdue: false };
  return { label: `Em ${Math.floor(days / 7)}sem`, overdue: false };
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<PipelineOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  // Filtrar por pesquisa
  const filtered = useMemo(() => {
    if (!search.trim()) return opportunities;
    const q = search.toLowerCase();
    return opportunities.filter(o =>
      o.nome.toLowerCase().includes(q) ||
      (o.empresa && o.empresa.toLowerCase().includes(q))
    );
  }, [opportunities, search]);

  // Agrupar por etapa
  const byStage = (stage: CrmEstado) => filtered.filter(o => o.estado_comercial === stage);
  const stageValue = (stage: CrmEstado) => byStage(stage).reduce((sum, o) => sum + o.valor_potencial, 0);
  const totalValue = filtered.reduce((sum, o) => sum + o.valor_potencial, 0);

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
          <Button variant="outline" size="sm" onClick={loadPipeline}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (opportunities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Oportunidades comerciais por etapa</p>
        </div>
        <Card>
          <CardContent className="p-8 md:p-12 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">O seu pipeline está vazio</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Comece por transformar um contacto numa oportunidade de venda.
                Quando um cliente avançar no processo comercial, ele aparecerá aqui.
              </p>
            </div>
            <Button onClick={() => navigate('/crm/contactos')} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Ver contactos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + search */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} oportunidade{filtered.length !== 1 ? 's' : ''} · {formatMZN(totalValue)} em total
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Procurar cliente ou empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Desktop Kanban — horizontal scroll */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {PIPELINE_STAGES.map(stage => {
          const items = byStage(stage.estado);
          return (
            <div key={stage.estado} className="flex-shrink-0 w-72">
              {/* Column header */}
              <div className={`rounded-t-xl ${stage.bg} px-3 py-2.5 border-b border-border`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage.dotColor}`} />
                    <span className={`font-semibold text-sm ${stage.color}`}>{stage.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{items.length}</span>
                </div>
                {items.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatMZN(stageValue(stage.estado))}
                  </div>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2 mt-2 min-h-[100px]">
                {items.map(opp => (
                  <OpportunityCard
                    key={opp.client_id}
                    opp={opp}
                    stageColor={stage.color}
                    dotColor={stage.dotColor}
                    onClick={() => navigate(`/crm/contactos/${opp.client_id}`)}
                  />
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground/40 text-center py-8 border border-dashed border-border/50 rounded-lg">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile — vertical by stage */}
      <div className="md:hidden space-y-5">
        {PIPELINE_STAGES.map(stage => {
          const items = byStage(stage.estado);
          if (items.length === 0) return null;
          return (
            <div key={stage.estado}>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${stage.dotColor}`} />
                  <span className={`font-semibold text-sm ${stage.color}`}>{stage.label}</span>
                  <span className="text-xs text-muted-foreground">· {items.length}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatMZN(stageValue(stage.estado))}</span>
              </div>
              <div className="space-y-2">
                {items.map(opp => (
                  <OpportunityCard
                    key={opp.client_id}
                    opp={opp}
                    stageColor={stage.color}
                    dotColor={stage.dotColor}
                    onClick={() => navigate(`/crm/contactos/${opp.client_id}`)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// OpportunityCard — cartão rico com informação comercial
// ============================================================

function OpportunityCard({
  opp,
  stageColor,
  dotColor,
  onClick,
}: {
  opp: PipelineOpportunity;
  stageColor: string;
  dotColor: string;
  onClick: () => void;
}) {
  const followUp = timeUntil(opp.proximo_contacto);
  const lastActivity = timeAgo(opp.ultimo_contacto);

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <CardContent className="p-3.5 space-y-2.5">
        {/* Nome + empresa */}
        <div>
          <div className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
            {opp.nome}
          </div>
          {opp.empresa && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{opp.empresa}</div>
          )}
        </div>

        {/* Valor + propostas */}
        <div className="flex items-center justify-between gap-2">
          {opp.valor_potencial > 0 ? (
            <span className="text-base font-bold text-emerald-600">
              {formatMZN(opp.valor_potencial)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">Valor não definido</span>
          )}
          {opp.proposta_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {opp.proposta_count}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/60 -mx-3.5" />

        {/* Última actividade */}
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Última: {lastActivity}
          </span>
        </div>

        {/* Próxima acção */}
        {opp.proximo_contacto ? (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            followUp.overdue ? 'text-red-600' : 'text-amber-600'
          }`}>
            <Calendar className="h-3 w-3" />
            {followUp.label}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
            <Circle className="h-2 w-2" />
            Sem próxima acção
          </div>
        )}
      </CardContent>
    </Card>
  );
}
