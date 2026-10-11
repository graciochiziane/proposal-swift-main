import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // M18 (2026-08-26): coverage config adicionada.
    // - v8 provider: mais rápido, sem deps extra (apenas @vitest/coverage-v8)
    // - Reporters: text (console), json (CI), html (local dev em coverage/)
    // - Sem thresholds enforcement (cobertura actual é ~0% — falhar build seria contraproducente)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      // Incluir apenas código fonte de aplicação (não testes, não types generated, não configs)
      include: ["src/**/*.{ts,tsx}"],
      // Excluir: testes proprios, setup, types gerados, components UI (shadcn), main entry, configs
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/integrations/supabase/types.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/components/ui/**",
        "src/App.tsx",
      ],
      // Não falhar build por baixa cobertura — apenas reportar
      all: false,
      skipFull: false,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
