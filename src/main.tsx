import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <PostHogProvider
    apiKey={import.meta.env.VITE_POSTHOG_KEY}
    options={{
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
      // Desactivado em desenvolvimento local
      enabled: !import.meta.env.DEV,
      // Não gravar IPs
      ip_anonymization_default: true,
    }}
  >
    <App />
  </PostHogProvider>
);
