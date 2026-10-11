import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { PostHogProvider } from 'posthog-js/react';
import { posthogClient } from './lib/posthog';

// const local: o narrowing persiste dentro das closures (bindings importados não)
const client = posthogClient;

const AppWithAnalytics = client
  ? () => (
      <PostHogProvider client={client}>
        <App />
    </PostHogProvider>
  )
  : () => <App />;

createRoot(document.getElementById("root")!).render(<AppWithAnalytics />);
