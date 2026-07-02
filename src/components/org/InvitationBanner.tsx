import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Loader2, X, Building2, Check } from 'lucide-react';
import { InvitationService, type Invitation } from '@/services/invitationService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

function roleLabel(role: string): string {
  switch (role) {
    case 'owner': return 'Dono';
    case 'admin': return 'Admin';
    case 'member': return 'Membro';
    case 'viewer': return 'Observador';
    default: return role;
  }
}

export default function InvitationBanner() {
  const { organization, refreshOrg } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const acceptingRef = useRef(false);

  // Se existe token no sessionStorage (user veio de link de email apos login),
  // redirecionar para a pagina de aceitacao
  useEffect(() => {
    const pendingToken = sessionStorage.getItem('invite_token');
    if (pendingToken && !organization) {
      sessionStorage.removeItem('invite_token');
      navigate(`/invite/accept?token=${pendingToken}`, { replace: true });
      return;
    }
  }, [organization, navigate]);

  const fetchInvitations = useCallback(async () => {
    // Se já tem organização, não precisa de ver convites
    if (organization) {
      setInvitations([]);
      setFetchState('success');
      return;
    }

    setFetchState('loading');
    try {
      const data = await InvitationService.getMyPendingInvitations();
      setInvitations(data);
      setFetchState('success');
    } catch (err) {
      console.error('Erro ao buscar convites pendentes:', err);
      setFetchState('error');
    }
  }, [organization]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleAccept = async (invitationId: string) => {
    // Prevenir cliques duplos via ref (não depende do state que é async)
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    setAcceptingId(invitationId);

    try {
      await InvitationService.accept(invitationId);
      toast.success('Convite aceite! Bem-vindo à organização.');
      // Remover o convite aceite da lista local
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      // Refrescar o contexto de org para ganhar acesso imediato
      await refreshOrg();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aceitar convite');
    } finally {
      setAcceptingId(null);
      // Debounce: impedir outro clique por 1 segundo após conclusão
      setTimeout(() => { acceptingRef.current = false; }, 1000);
    }
  };

  const handleDismiss = (invitationId: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
  };

  // Loading: renderizar nada (fetch silencioso)
  if (fetchState === 'idle' || fetchState === 'loading') return null;

  // Error: renderizar nada (não quebrar a app por causa de convites)
  if (fetchState === 'error') return null;

  // Empty: renderizar nada
  if (invitations.length === 0) return null;

  // Se já aceitou e agora tem org, não mostrar
  if (organization) return null;

  return (
    <div className="space-y-3 mb-6">
      {invitations.map((inv) => {
        // O join organizations(nome) devolve o campo dentro do objeto
        const orgName = (inv as any).organizations?.nome || 'Organização';
        const isAccepting = acceptingId === inv.id;

        return (
          <Card key={inv.id} className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      Convite para {orgName}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Foi convidado como{' '}
                      <Badge variant="outline" className="text-[11px] px-1.5 py-0 align-middle">
                        {roleLabel(inv.role)}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Building2 className="h-3 w-3 inline mr-1" />
                      {orgName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(inv.id)}
                    disabled={isAccepting}
                    className="gap-1.5"
                  >
                    {isAccepting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {isAccepting ? 'A aceitar...' : 'Aceitar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDismiss(inv.id)}
                    aria-label="Dispensar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}