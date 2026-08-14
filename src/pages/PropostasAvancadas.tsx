// ============================================================
// Página: Propostas Avançadas (listagem)
//
// Lista todas as propostas avançadas da organização actual.
// Permite criar nova, abrir existente, ver status.
//
// Visível para todos os utilizadores (gate por plano será adicionado
// quando os planos comerciais forem lançados).
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Sparkles, FileText, Eye, Trash2, Loader2,
  CheckCircle2, Clock, Edit3, AlertCircle,
} from 'lucide-react';
import {
  getAdvancedProposalsWithBlueprint,
  deleteAdvancedProposal,
} from '@/services/advancedProposalService';
import type { AdvancedProposalStatus } from '@/types/advancedProposal';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { toast } from 'sonner';

interface ProposalWithMeta {
  id: string;
  title: string;
  status: AdvancedProposalStatus;
  created_at: string;
  updated_at: string;
  blueprint_name: string;
  category_name: string;
  current_section_index: number;
  total_sections: number;
}

const STATUS_CONFIG: Record<AdvancedProposalStatus, {
  label: string;
  cor: string;
  bg: string;
  icon: typeof Clock;
}> = {
  rascunho:       { label: 'Rascunho',      cor: 'text-gray-500',   bg: 'bg-gray-100',   icon: FileText },
  em_preenchimento: { label: 'Em preenchimento', cor: 'text-blue-600', bg: 'bg-blue-100', icon: Edit3 },
  em_revisao:     { label: 'Em revisão',    cor: 'text-amber-600',  bg: 'bg-amber-100',  icon: Clock },
  concluida:      { label: 'Concluída',     cor: 'text-emerald-600',bg: 'bg-emerald-100',icon: CheckCircle2 },
  exportada:      { label: 'Exportada',     cor: 'text-purple-600', bg: 'bg-purple-100', icon: CheckCircle2 },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-MZ', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function PropostasAvancadas() {
  const navigate = useNavigate();
  const { hasFeature, loading: featuresLoading } = usePlanFeatures();

  const [propostas, setPropostas] = useState<ProposalWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Por defeito, mostra o botão. Só esconde se usePlanFeatures carregou
  // correctamente E retornou enabled=false. Se featuresLoading=true ou
  // houve erro, assume que pode criar (defensive default).
  const canCreate = featuresLoading || hasFeature('advanced_proposals');

  const loadPropostas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdvancedProposalsWithBlueprint();
      setPropostas(data as ProposalWithMeta[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      console.error('[PropostasAvancadas] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPropostas();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteAdvancedProposal(id);
      setPropostas(prev => prev.filter(p => p.id !== id));
      setConfirmDelete(null);
      toast.success('Proposta avançada eliminada');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao eliminar';
      toast.error('Erro ao eliminar: ' + msg);
    }
  };

  const sortedPropostas = useMemo(() => {
    return [...propostas].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [propostas]);

  // Loading state — only wait for proposals, not features
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>A carregar propostas avançadas...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold">Erro ao carregar propostas</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={loadPropostas}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Propostas Avançadas
            </h1>
            <p className="text-sm text-muted-foreground">
              Documentos comerciais estruturados com blueprint + IA
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => navigate('/proposta-avancada/nova')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 active:scale-[0.97] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Proposta</span>
            <span className="sm:hidden">Nova</span>
          </button>
        )}
      </div>

      {/* Empty state */}
      {sortedPropostas.length === 0 ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Sparkles className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Nenhuma proposta avançada ainda</h2>
            <p className="text-sm text-muted-foreground">
              Crie a sua primeira proposta comercial estruturada com blueprint,
              perguntas guiadas e geração de conteúdo por IA.
            </p>
            {canCreate && (
              <button
                onClick={() => navigate('/proposta-avancada/nova')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                Criar primeira proposta
              </button>
            )}
          </div>
        </div>
      ) : (
        /* List of proposals */
        <div className="space-y-3">
          {sortedPropostas.map((p) => {
            const status = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.rascunho;
            const StatusIcon = status.icon;
            const progress = p.total_sections > 0
              ? Math.round((p.current_section_index / p.total_sections) * 100)
              : 0;

            return (
              <div
                key={p.id}
                className="bg-card rounded-xl p-4 md:p-5 border border-border hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title + status */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-base truncate">
                        {p.title || 'Sem título'}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.cor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>

                    {/* Blueprint + category */}
                    <p className="text-sm text-muted-foreground truncate">
                      {p.category_name && `${p.category_name} — `}
                      {p.blueprint_name || 'Blueprint não definido'}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
                      <span>Criada em {formatDate(p.created_at)}</span>
                      <span>•</span>
                      <span>Actualizada em {formatDate(p.updated_at)}</span>
                    </div>

                    {/* Progress bar */}
                    {p.status !== 'concluida' && p.status !== 'exportada' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso</span>
                          <span>{p.current_section_index} / {p.total_sections} secções</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/proposta-avancada/${p.id}`)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Abrir"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {confirmDelete === p.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(p.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature disabled notice (future: when plans are gated) */}
      {!canCreate && sortedPropostas.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Funcionalidade não disponível no seu plano.</strong>
          <br />
          As propostas avançadas estão disponíveis para planos superiores.
          Contacte o administrador para fazer upgrade.
        </div>
      )}
    </div>
  );
}
