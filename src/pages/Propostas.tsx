import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, Eye, Copy, Trash2, Loader2,
  FileText, TrendingUp, BarChart3, Calendar, ChevronDown,
  MoreHorizontal, FileCheck, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { PropostaService, formatMZN } from '@/services/propostaService';
import { getFaturasPorProposta } from '@/services/faturaService';
import type { PropostaResumo } from '@/services/propostaService';
import type { StatusProposta } from '@/types';
import type { Fatura } from '@/types';
import { toast } from 'sonner';

type FiltroStatus = 'todas' | StatusProposta;

const STATUS_CONFIG: Record<StatusProposta, { label: string; cor: string; bg: string; icon: typeof Clock }> = {
  rascunho: { label: 'Rascunho', cor: 'text-gray-500', bg: 'bg-gray-100', icon: FileText },
  enviada: { label: 'Enviada', cor: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  aceite: { label: 'Aceite', cor: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
  rejeitada: { label: 'Rejeitada', cor: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
};

const FILTROS: { valor: FiltroStatus; label: string }[] = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'rascunho', label: 'Rascunho' },
  { valor: 'enviada', label: 'Enviada' },
  { valor: 'aceite', label: 'Aceite' },
  { valor: 'rejeitada', label: 'Rejeitada' },
];

export default function Propostas() {
  const navigate = useNavigate();
  const [propostas, setPropostas] = useState<PropostaResumo[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [acaoDropdown, setAcaoDropdown] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setAcaoDropdown(null);
      }
    }
    document.addEventListener('click', handleClickFora);
    return () => document.removeEventListener('click', handleClickFora);
  }, []);

  async function loadData() {
    try {
      const [dataPropostas, dataFaturas] = await Promise.all([
        PropostaService.getPropostas(),
        Promise.all(
          (await PropostaService.getPropostas()).map((p) =>
            getFaturasPorProposta(p.id).catch(() => [] as Fatura[])
          )
        ),
      ]);
      setPropostas(dataPropostas);
      setFaturas(dataFaturas.flat());
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const contagemFaturas = useMemo(() => {
    const map = new Map<string, number>();
    faturas.forEach((f) => {
      if (f.proposal_id) {
        map.set(f.proposal_id, (map.get(f.proposal_id) || 0) + 1);
      }
    });
    return map;
  }, [faturas]);

  const propostasFiltradas = useMemo(() => {
    let resultado = propostas;

    if (filtroStatus !== 'todas') {
      resultado = resultado.filter((p) => p.status === filtroStatus);
    }

    if (search.trim()) {
      const termo = search.toLowerCase().trim();
      resultado = resultado.filter(
        (p) =>
          p.numero?.toLowerCase().includes(termo) ||
          p.clienteNome?.toLowerCase().includes(termo) ||
          p.observacoes?.toLowerCase().includes(termo)
      );
    }

    return resultado;
  }, [propostas, filtroStatus, search]);

  const stats = useMemo(() => {
    const totalGeral = propostas.reduce((s, p) => s + p.total, 0);
    const porStatus = {
      rascunho: propostas.filter((p) => p.status === 'rascunho').length,
      enviada: propostas.filter((p) => p.status === 'enviada').length,
      aceite: propostas.filter((p) => p.status === 'aceite').length,
      rejeitada: propostas.filter((p) => p.status === 'rejeitada').length,
    };
    const faturadas = contagemFaturas.size;
    return { totalGeral, total: propostas.length, porStatus, faturadas };
  }, [propostas, contagemFaturas]);

  async function handleDuplicar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setAcaoDropdown(null);
    try {
      const nova = await PropostaService.duplicarProposta(id);
      toast.success('Proposta duplicada');
      navigate(`/proposta/${nova.id}`);
    } catch (error) {
      toast.error('Erro ao duplicar proposta');
    }
  }

  async function handleEliminar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setAcaoDropdown(null);
    if (!confirm('Tem a certeza que deseja eliminar esta proposta? Esta acção é irreversível.')) return;
    try {
      await PropostaService.removerProposta(id);
      setPropostas((prev) => prev.filter((p) => p.id !== id));
      toast.success('Proposta eliminada');
    } catch (error) {
      toast.error('Erro ao eliminar proposta');
    }
  }

  async function handleAlterarStatus(id: string, novoStatus: StatusProposta, e: React.MouseEvent) {
    e.stopPropagation();
    setAcaoDropdown(null);
    try {
      await PropostaService.atualizarStatus(id, novoStatus);
      setPropostas((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p))
      );
      toast.success(`Status alterado para ${STATUS_CONFIG[novoStatus].label}`);
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  }

  function formatarData(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-MZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar propostas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
            Propostas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie o historico completo das suas propostas comerciais
          </p>
        </div>
        <button
          onClick={() => navigate('/proposta/nova')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:brightness-110 active:scale-[0.97] transition-all"
        >
          <Plus className="h-4 w-4" /> Nova Proposta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-up">
        <div className="bg-card rounded-xl p-4 border border-border card-float">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium">Total</span>
          </div>
          <p className="text-xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{formatMZN(stats.totalGeral)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border card-float">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium">Rascunho</span>
          </div>
          <p className="text-xl font-bold text-gray-600">{stats.porStatus.rascunho}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border card-float">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Enviada</span>
          </div>
          <p className="text-xl font-bold text-blue-600">{stats.porStatus.enviada}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border card-float">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Aceite</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{stats.porStatus.aceite}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border card-float">
          <div className="flex items-center gap-2 text-violet-500 mb-1">
            <FileCheck className="h-4 w-4" />
            <span className="text-xs font-medium">Facturadas</span>
          </div>
          <p className="text-xl font-bold text-violet-600">{stats.faturadas}</p>
        </div>
      </div>

      {/* Search + Filtros */}
      <div className="space-y-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar por numero, cliente ou observacoes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {FILTROS.map((f) => {
            const isActive = filtroStatus === f.valor;
            const count =
              f.valor === 'todas'
                ? propostas.length
                : propostas.filter((p) => p.status === f.valor).length;
            return (
              <button
                key={f.valor}
                onClick={() => setFiltroStatus(f.valor)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                {f.label}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-primary-foreground/20' : 'bg-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Propostas */}
      <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
        {propostasFiltradas.length === 0 ? (
          <div className="bg-card rounded-xl p-12 border border-border text-center card-float">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-medium text-muted-foreground">
              {search || filtroStatus !== 'todas'
                ? 'Nenhuma proposta encontrada com os filtros aplicados'
                : 'Nenhuma proposta criada ainda'}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {search || filtroStatus !== 'todas'
                ? 'Tente ajustar os filtros ou a pesquisa'
                : 'Clique em "Nova Proposta" para comecar'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {propostasFiltradas.map((p, i) => {
              const statusCfg = STATUS_CONFIG[p.status];
              const StatusIcon = statusCfg.icon;
              const numFaturas = contagemFaturas.get(p.id) || 0;

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/proposta/${p.id}`)}
                  className="bg-card rounded-xl p-4 md:p-5 border border-border card-float hover:border-primary/30 transition-colors animate-fade-up cursor-pointer group"
                  style={{ animationDelay: `${200 + i * 40}ms` }}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Info principal */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-primary">
                          {p.numero}
                        </span>
                        <span className="text-xs text-muted-foreground/40">|</span>
                        <p className="font-medium truncate">{p.clienteNome || 'Sem cliente'}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatarData(p.data)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCfg.bg} ${statusCfg.cor}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                        {numFaturas > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-violet-600">
                            <FileCheck className="h-3 w-3" />
                            {numFaturas} factura{numFaturas > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Valor + Acções */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-primary font-bold whitespace-nowrap text-sm md:text-base">
                        {formatMZN(p.total)}
                      </p>

                      {/* Ações rápidas */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/proposta/${p.id}`);
                          }}
                          className="p-2 rounded-lg hover:bg-secondary transition-colors"
                          title="Ver proposta"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Dropdown de acções */}
                        <div className="relative" data-dropdown>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAcaoDropdown(acaoDropdown === p.id ? null : p.id);
                            }}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors"
                            title="Mais acções"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {acaoDropdown === p.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-48 bg-card rounded-xl border border-border shadow-lg z-50 py-1 animate-fade-up"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Alterar status */}
                              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Alterar Status
                              </div>
                              {(
                                ['rascunho', 'enviada', 'aceite', 'rejeitada'] as StatusProposta[]
                              ).map((s) => (
                                <button
                                  key={s}
                                  onClick={(e) => handleAlterarStatus(p.id, s, e)}
                                  disabled={p.status === s}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                    p.status === s
                                      ? 'text-muted-foreground/50 cursor-default'
                                      : 'text-foreground hover:bg-secondary'
                                  }`}
                                >
                                  {(() => {
                                    const cfg = STATUS_CONFIG[s];
                                    const Icon = cfg.icon;
                                    return <Icon className="h-3.5 w-3.5" />;
                                  })()}
                                  {STATUS_CONFIG[s].label}
                                  {p.status === s && (
                                    <CheckCircle className="h-3.5 w-3.5 ml-auto text-primary" />
                                  )}
                                </button>
                              ))}

                              <div className="my-1 border-t border-border" />

                              <button
                                onClick={(e) => handleDuplicar(p.id, e)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-foreground hover:bg-secondary transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Duplicar
                              </button>

                              <button
                                onClick={(e) => handleEliminar(p.id, e)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Footer com contagem */}
            <div className="text-center text-xs text-muted-foreground pt-4">
              Mostrando {propostasFiltradas.length} de {propostas.length} proposta
              {propostas.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
