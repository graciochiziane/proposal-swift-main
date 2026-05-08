import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowRight, Trash2, TrendingUp, Calendar, BarChart3, Loader2 } from 'lucide-react';
import { PropostaService, formatMZN, formatCompactMZN } from '@/services/propostaService';
import { useState, useMemo, useEffect } from 'react';
import type { PropostaResumo } from '@/services/propostaService';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const [propostas, setPropostas] = useState<PropostaResumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPropostas();
  }, []);

  async function fetchPropostas() {
    try {
      const data = await PropostaService.getPropostas();
      setPropostas(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar propostas');
    } finally {
      setLoading(false);
    }
  }

  const handleRemover = async (id: string) => {
    if (!confirm('Tem a certeza que deseja remover esta proposta?')) return;

    try {
      await PropostaService.removerProposta(id);
      setPropostas(prev => prev.filter(p => p.id !== id));
      toast.success('Proposta removida');
    } catch (error) {
      toast.error('Erro ao remover proposta');
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = propostas.filter(p => {
      const d = new Date(p.data);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalGeral = propostas.reduce((s, p) => s + p.total, 0);
    const totalMes = thisMonth.reduce((s, p) => s + p.total, 0);
    const media = propostas.length > 0 ? totalGeral / propostas.length : 0;
    return { totalGeral, totalMes, propostasMes: thisMonth.length, media };
  }, [propostas]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar propostas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas propostas comerciais</p>
        </div>
        <button
          onClick={() => navigate('/proposta/nova')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:brightness-110 active:scale-[0.97] transition-all"
        >
          <Plus className="h-4 w-4" />
          Nova Proposta
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up">
        <div className="bg-card rounded-xl p-5 card-float border border-border">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Propostas</p>
          </div>
          <p className="text-2xl font-bold">{propostas.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 card-float border border-border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Valor Total</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-primary truncate">{formatCompactMZN(stats.totalGeral)}</p>
        </div>
        <div className="bg-card rounded-xl p-5 card-float border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Este Mês</p>
          </div>
          <p className="text-2xl font-bold">{stats.propostasMes}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatMZN(stats.totalMes)}</p>
        </div>
        <div className="bg-card rounded-xl p-5 card-float border border-border">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Média</p>
          </div>
          <p className="text-xl md:text-2xl font-bold truncate">{formatCompactMZN(stats.media)}</p>
        </div>
      </div>

      <div className="animate-fade-up">
        <h2 className="text-lg font-semibold mb-4">Propostas Recentes</h2>
        {propostas.length === 0 ? (
          <div className="bg-card rounded-xl p-12 border border-border text-center card-float">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma proposta ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Crie sua primeira proposta em menos de 1 minuto</p>
          </div>
        ) : (
          <div className="space-y-3">
            {propostas.slice(0, 10).map((p, i) => (
              <div
                key={p.id}
                className="bg-card rounded-xl p-4 md:p-5 border border-border card-float group hover:border-primary/30 transition-colors animate-fade-up"
                style={{ animationDelay: `${200 + i * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold truncate min-w-0">{p.clienteNome}</p>
                  <p className="text-primary font-bold whitespace-nowrap text-sm md:text-base">{formatMZN(p.total)}</p>
                </div>
                <div className="flex items-center justify-between gap-4 mt-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono">{p.numero}</span>
                    <span className="text-xs text-muted-foreground">{new Date(p.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigate(`/proposta/${p.id}`)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><ArrowRight className="h-4 w-4" /></button>
                    <button onClick={() => handleRemover(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}