import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthogClient = POSTHOG_KEY
  ? posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
     session_recording: {
        sampleRate: 0.3,
      },
     mask_all_element_attributes: true,
     mask_all_text: false,
     mask_inputs: ['password', 'email', 'tel', 'number'],
     ip_anonymization_default: true,
     pageview_ignore_list: ['/auth', '/login', '/register'],
     autocapture: false,
   })
  : null;
