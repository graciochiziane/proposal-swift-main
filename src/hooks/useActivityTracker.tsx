import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';

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
    const page = location.pathname;
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
