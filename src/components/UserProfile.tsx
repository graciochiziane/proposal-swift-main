import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield,
  User as UserIcon,
  Settings,
  CreditCard,
  ShieldCheck,
  Moon,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProfileData {
  nome: string | null;
  email: string;
  plano: string;
}

function getInitials(name: string | null | undefined, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function planLabel(plano: string): string {
  switch (plano) {
    case 'business': return 'Business';
    case 'pro': return 'Pro';
    default: return 'Free';
  }
}

function planBadgeClasses(plano: string): string {
  switch (plano) {
    case 'business':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'pro':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export default function UserProfile({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('nome, email, plano').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
      ]);

      if (cancelled) return;

      setProfile({
        nome: prof?.nome ?? (user.user_metadata?.nome as string) ?? null,
        email: prof?.email ?? user.email ?? '',
        plano: prof?.plano ?? 'free',
      });
      setIsAdmin(!!roles?.some(r => r.role === 'admin'));
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (!user || !profile) return null;

  const initials = getInitials(profile.nome, profile.email);
  const displayName = profile.nome?.trim() || profile.email.split('@')[0];

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão terminada');
    navigate('/auth', { replace: true });
  };

  const go = (path: string) => navigate(path);
  const soon = (label: string) => toast.info(`${label} — em breve`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg p-1 pr-2 hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Abrir menu de perfil"
        >
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-sm">
            {initials}
            {isAdmin && (
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-accent border-2 border-background flex items-center justify-center">
                <Shield className="h-2.5 w-2.5 text-accent-foreground" />
              </span>
            )}
          </div>

          {!compact && (
            <div className="hidden lg:flex flex-col leading-tight min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">
                  {displayName}
                </span>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-accent/15 text-accent border border-accent/30">
                    SUPERADMIN
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {profile.email}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        {/* Header */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-start gap-3 py-1">
            <div className="relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-base font-semibold shadow-sm">
              {initials}
              {isAdmin && (
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-accent border-2 border-popover flex items-center justify-center">
                  <Shield className="h-2.5 w-2.5 text-accent-foreground" />
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0 gap-1">
              <span className="text-sm font-semibold text-foreground truncate">
                {displayName}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {profile.email}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {isAdmin && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-accent/15 text-accent border border-accent/30">
                    SUPERADMIN
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${planBadgeClasses(profile.plano)}`}>
                  {planLabel(profile.plano)}
                </span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Conta */}
        <DropdownMenuItem onClick={() => go('/configuracoes')}>
          <UserIcon className="mr-2 h-4 w-4" />
          Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go('/configuracoes')}>
          <Settings className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => soon('Plano & Faturação')}>
          <CreditCard className="mr-2 h-4 w-4" />
          Plano & Faturação
        </DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => go('/admin')}>
              <ShieldCheck className="mr-2 h-4 w-4 text-accent" />
              Painel SuperAdmin
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Preferências */}
        <DropdownMenuItem onClick={() => soon('Tema')}>
          <Moon className="mr-2 h-4 w-4" />
          Tema (claro/escuro)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => soon('Ajuda & Suporte')}>
          <HelpCircle className="mr-2 h-4 w-4" />
          Ajuda & Suporte
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sessão */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
