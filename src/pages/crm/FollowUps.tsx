// ============================================================
// Follow-ups — Lista de follow-ups (vencidos, hoje, próximos)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Calendar, Check, Clock, BellRing } from 'lucide-react';
import { CrmService, type CrmFollowUp } from '@/services/crmService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-MZ', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function FollowUps() {
  const navigate = useNavigate();
  const [overdue, setOverdue] = useState<CrmFollowUp[]>([]);
  const [today, setToday] = useState<CrmFollowUp[]>([]);
  const [upcoming, setUpcoming] = useState<CrmFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFollowUps = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overdueData, todayData, upcomingData] = await Promise.all([
        CrmService.getFollowUps('overdue'),
        CrmService.getFollowUps('today'),
        CrmService.getFollowUps('upcoming'),
      ]);
      setOverdue(overdueData);
      setToday(todayData);
      setUpcoming(upcomingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await CrmService.completeFollowUp(id);
      toast.success('Follow-up concluído');
      loadFollowUps();
    } catch {
      toast.error('Erro ao concluir');
    }
  };

  useEffect(() => { loadFollowUps(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadFollowUps}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const total = overdue.length + today.length + upcoming.length;

  const renderList = (items: CrmFollowUp[], emptyMsg: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>;
    }
    return (
      <div className="space-y-2">
        {items.map(f => (
          <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{f.title}</div>
              {f.description && <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>}
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(f.due_at)}
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => handleComplete(f.id)} className="gap-1 text-emerald-600 hover:text-emerald-700 h-7 px-2">
                <Check className="h-3.5 w-3.5" />Concluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/crm/contactos/${f.client_id}`)} className="h-7 px-2 text-xs">
                Ver cliente
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">{total} follow-up{total !== 1 ? 's' : ''} pendente{total !== 1 ? 's' : ''}</p>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Calendar className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Nenhum follow-up pendente</h2>
            <p className="text-sm text-muted-foreground">Agende follow-ups nos detalhes de cada contacto.</p>
            <Button onClick={() => navigate('/crm/contactos')} variant="outline">Ver contactos</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-red-600">
                  <BellRing className="h-5 w-5" />
                  Vencidos ({overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent>{renderList(overdue, '')}</CardContent>
            </Card>
          )}

          {today.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-amber-600">
                  <Clock className="h-5 w-5" />
                  Hoje ({today.length})
                </CardTitle>
              </CardHeader>
              <CardContent>{renderList(today, '')}</CardContent>
            </Card>
          )}

          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  Próximos ({upcoming.length})
                </CardTitle>
              </CardHeader>
              <CardContent>{renderList(upcoming, '')}</CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
