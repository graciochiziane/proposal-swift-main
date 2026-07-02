import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Check, AlertTriangle, LogIn, UserPlus } from 'lucide-react';
import { InvitationService } from '@/services/invitationService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type PageState = 'loading' | 'invalid' | 'not_logged_in' | 'accepting' | 'accepted' | 'error';

function roleLabel(role: string): string {
  switch (role) {
    case 'owner': return 'Dono';
    case 'admin': return 'Admin';
    case 'member': return 'Membro';
    case 'viewer': return 'Observador';
    default: return role;
  }
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshOrg } = useAuth();

  const token = searchParams.get('token');
  const [pageState, setPageState] = useState<PageState>('loading');
  const [orgName, setOrgName] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const acceptingRef = useRef(false);

  // Buscar dados do convite pelo token
  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      setErrorMsg('Link de convite invalido (token ausente).');
      return;
    }

    InvitationService.getByToken(token).then((invite) => {
      if (!invite) {
        setPageState('invalid');
        setErrorMsg('Este convite nao existe ou ja expirou.');
        return;
      }

      setOrgName(invite.orgNome || 'Organização');
      setRole(invite.role);

      if (user) {
        // User logado: tentar aceitar automaticamente
        setPageState('accepting');
      } else {
        // User nao logado: mostrar opcao de login/signup
        setPageState('not_logged_in');
        sessionStorage.setItem('invite_token', token);
      }
    }).catch(() => {
      setPageState('error');
      setErrorMsg('Erro ao validar o convite. Tente novamente.');
    });
  }, [token]); // Intencionalmente sem 'user' — corre uma vez

  // Quando o user fica logado (AuthContext), tentar aceitar
  useEffect(() => {
    if (user && pageState === 'not_logged_in') {
      handleAccept();
    }
  }, [user, pageState]);

  const handleAccept = async () => {
    if (acceptingRef.current || !token) return;
    acceptingRef.current = true;
    setPageState('accepting');

    try {
      await InvitationService.acceptByToken(token!);
      sessionStorage.removeItem('invite_token');
      await refreshOrg();
      setPageState('accepted');
    } catch (err: any) {
      setPageState('error');
      setErrorMsg(err.message || 'Erro ao aceitar o convite.');
      acceptingRef.current = false;
    }
  };

  const goToAuth = (mode: 'login' | 'signup') => {
    // O token ja esta em sessionStorage — a pos-login o effect acima dispara
    navigate(`/auth?mode=${mode}`);
  };

  // Loading
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">A validar convite...</p>
        </div>
      </div>
    );
  }

  // Invalid / Error
  if (pageState === 'invalid' || pageState === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">Convite Invalido</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Ir para o inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepted
  if (pageState === 'accepted') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold">Bem-vindo a {orgName}!</h1>
            <p className="text-muted-foreground">
              O seu acesso a organizacao foi configurado com sucesso.
            </p>
            <Button onClick={() => navigate('/')}>
              Ir para o Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in
  if (pageState === 'not_logged_in') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Convite para {orgName}</h1>
            <p className="text-muted-foreground">
              Foi convidado como{' '}
              <Badge variant="outline">{roleLabel(role)}</Badge>
            </p>
            <div className="pt-2 space-y-3">
              <Button className="w-full gap-2" onClick={() => goToAuth('login')}>
                <LogIn className="h-4 w-4" />
                Entrar na minha conta
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => goToAuth('signup')}>
                <UserPlus className="h-4 w-4" />
                Criar conta
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Apos o login, o convite sera aceite automaticamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting (user logado, a processar)
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <h1 className="text-xl font-semibold">A aceitar convite...</h1>
          <p className="text-muted-foreground">
            A juntar-se a {orgName}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}