// ============================================================
// Actividades — Lista de actividades recentes
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Clock, Plus } from 'lucide-react';
import { CrmService, type CrmActivity } from '@/services/crmService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-MZ', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function Actividades() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await CrmService.getRecentActivities(50);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar actividades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadActivities(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadActivities}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Actividades</h1>
        <p className="text-sm text-muted-foreground">{activities.length} actividade{activities.length !== 1 ? 's' : ''} recente{activities.length !== 1 ? 's' : ''}</p>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Clock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Nenhuma actividade registada</h2>
            <p className="text-sm text-muted-foreground">Registe actividades nos detalhes de cada contacto.</p>
            <Button onClick={() => navigate('/crm/contactos')} variant="outline">Ver contactos</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-3">
              {activities.map(a => (
                <div key={a.id} className="flex gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.title}</span>
                      <Badge variant="outline" className="text-xs">{a.type}</Badge>
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>}
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(a.performed_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
