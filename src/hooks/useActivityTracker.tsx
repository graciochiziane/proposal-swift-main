import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';

/**
 * Sanitiza pathname antes de enviar ao analytics.
 *
 * Defensivo: `location.pathname` do react-router-dom já retorna pathname
 * limpo (sem query string nem hash), mas esta função protege contra
 * refactors futuros que usem `window.location` ou APIs diferentes.
 *
 * - Remove query string e hash fragment (split em `?` ou `#`)
 * - Valida que começa com `/` (fallback para `/`)
 * - Limita a 500 chars (cap DoS na coluna `user_activity.page`)
 */
function sanitizePath(pathname: string | null | undefined): string {
  if (!pathname || typeof pathname !== 'string') return '/';
  // Strip query string e hash (defensivo — react-router já separa)
  const clean = pathname.split(/[?#]/)[0];
  // Valida formato (deve começar com /)
  if (!clean.startsWith('/')) return '/';
  // Cap de comprimento para prevenir DoS em queries/INSERT
  return clean.length > 500 ? clean.substring(0, 500) : clean;
}

/**
 * Hook que regista automaticamente a actividade do utilizador.
 * - Regista visita à página quando o user navega (deduplicado a cada 5 min)
 * - Actualiza last_seen_at no perfil (usado para "online now")
 * - Heartbeat a cada 5 min para manter last_seen_at fresco
 */
export function useActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const userIdRef = useRef<string | null>(null);
  const pageRef = useRef<string>('/');
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;
    // M17 (2026-08-26): sanitize pathname antes de enviar ao analytics
    const page = sanitizePath(location.pathname);
    userIdRef.current = userId;

    // Registar visita imediata (com deduplicação no service)
    analyticsService.trackPageVisit(userId, page);
    pageRef.current = page;

    // Heartbeat: actualizar last_seen_at a cada 5 min
    heartbeatRef.current = setInterval(() => {
      if (userIdRef.current) {
        analyticsService.trackPageVisit(userIdRef.current, pageRef.current);
      }
    }, 5 * 60 * 1000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [user?.id, location.pathname]);
}
