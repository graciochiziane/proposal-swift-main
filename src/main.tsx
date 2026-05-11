import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { PostHogProvider } from 'posthog-js/react';
import { posthogClient } from './lib/posthog';

const AppWithAnalytics = posthogClient
  ? () => (
      <PostHogProvider client={posthogClient}>
        <App />
    </PostHogProvider>
  )
  : () => <App />;

createRoot(document.getElementById("root")!).render(<AppWithAnalytics />);
