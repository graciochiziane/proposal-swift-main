// ============================================================
// PostHog Analytics Configuration — ProposalJá
// Session Replay (30% sample) + Product Analytics
// Segurança: exclui páginas sensíveis, não captura inputs
// ============================================================

import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

// Páginas que NÃO devem ser gravadas (session replay) nem trackeadas
const EXCLUDED_PATHS = ['/auth', '/forgot-password', '/reset-password'];

// Utilizado em useAuth.tsx para identificar o utilizador
// Exportado separadamente para evitar dependência circular
export let posthogInstance: ReturnType<typeof posthog.init> | null = null;

export function initPostHog(): ReturnType<typeof posthog.init> | null {
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] VITE_POSTHOG_KEY não configurada — analytics desactivado');
    return null;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // ---- Session Replay Config ----
    // Gravar apenas 30% das sessões para economizar quota free (1M eventos/mês)
    session_recording: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recordCrossOriginIframes: false as any,
      maskAllInputs: true, // Ocultar todos os inputs (emails, dados de clientes, etc.)
      maskTextSelector: '.sensitive, [data-sensitive]', // Elementos com classe 'sensitive' são ocultados
    },
    // Sample rate de 30% para Session Replay (0.0 a 1.0)
    // Cada sessão tem 30% de probabilidade de ser gravada
    disable_session_recording: false,

    // ---- Autocapture Config ----
    // Capturar automaticamente cliques e pageviews
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: false, // Não capturar page leave para economizar eventos

    // ---- Privacy Config ----
    // Não persistir em cookies (usa localStorage) — mais compatível
    persistence: 'localStorage+cookie',
    // Não gravar o IP dos utilizadores
    ip_anonymization_default: true,
    // Não capturar URLs com query params sensíveis
    sanitize_properties: (properties) => {
      const url = properties.$current_url as string || '';
      // Remover query params de URLs (podem conter tokens, session IDs, etc.)
      const cleanUrl = url.split('?')[0];
      properties.$current_url = cleanUrl;
      return properties;
    },

    // ---- Performance Config ----
    // Atrasar carregamento para não afectar performance inicial
    bootstrap: {
      // Não bloquear o render
    },
    // Desactivar em desenvolvimento local
    disabled: import.meta.env.DEV,

    // ---- Batch Config ----
    // Enviar eventos em batch a cada 5 segundos (em vez de 1 a 1)
    request_batching: true,
    batch_size: 20,
    flush_interval: 5000,

    // ---- Feature Flags ----
    // Desactivado por agora (activar quando necessário)
    feature_flag_request_interval_ms: 300000, // Verificar flags a cada 5 min (não a cada request)
  });

  posthogInstance = posthog;

  console.log('[PostHog] Inicializado com sucesso');

  return posthog;
}

/**
 * Verifica se a página actual deve ser excluída do tracking
 */
export function shouldTrack(): boolean {
  const path = window.location.pathname;
  return !EXCLUDED_PATHS.some(excluded => path.startsWith(excluded));
}

/**
 * Determina se esta sessão deve ser gravada (30% sample rate)
 * Chamado explicitamente antes de iniciar session recording
 */
export function shouldRecordSession(): boolean {
  return Math.random() < 0.3;
}

/**
 * Iniciar session replay (com sample rate de 30%)
 * Chamar apenas quando o utilizador está autenticado
 */
export function startSessionRecording(): void {
  if (!posthogInstance || !shouldRecordSession()) {
    return;
  }

  if (shouldTrack()) {
    posthogInstance.startSessionRecording();
    console.log('[PostHog] Session recording iniciada (sample)');
  }
}

/**
 * Parar session replay
 * Chamar quando o utilizador faz logout
 */
export function stopSessionRecording(): void {
  if (!posthogInstance) return;
  posthogInstance.stopSessionRecording();
}

/**
 * Identificar utilizador com dados do Supabase Auth
 */
export function identifyUser(userId: string, properties?: Record<string, string>): void {
  if (!posthogInstance) return;
  posthogInstance.identify(userId, properties);
}

/**
 * Reset do utilizador (logout)
 */
export function resetUser(): void {
  if (!posthogInstance) return;
  stopSessionRecording();
  posthogInstance.reset();
}
