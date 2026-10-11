import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

// Notas de correção (2026-08-28, ver CHANGELOG):
// - 'mask_inputs' NÃO existe em PostHogConfig (posthog-js 1.396.4) — estava a ser
//   silenciosamente ignorado. Substituído por session_recording.maskInputOptions,
//   que ACTIVA a máscara de password/email/tel/number nos session replays
//   (a intenção original do autor). password também é mascarado por default (rrweb).
// - 'ip_anonymization_default' NÃO existe; a prop 'ip' equivalente está deprecated
//   com NO EFFECT. Anonimização de IP é um setting server-side do projecto PostHog
//   ("Discard IP data") — a activar no dashboard, não no client.
// - 'pageview_ignore_list' NÃO existe; irrelevante porque capture_pageview: false
//   (a app rastreia pageviews via useActivityTracker próprio).
export const posthogClient = POSTHOG_KEY
  ? posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      session_recording: {
        sampleRate: 0.3,
        maskInputOptions: { password: true, email: true, tel: true, number: true },
      },
      mask_all_element_attributes: true,
      mask_all_text: false,
      autocapture: false,
    })
  : null;
