import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import Catalogo from "@/pages/Catalogo";
import CriarProposta from "@/pages/CriarProposta";
import Propostas from "@/pages/Propostas";
import PropostasAvancadas from "@/pages/PropostasAvancadas";
import ResumoProposta from "@/pages/ResumoProposta";
import GerarPropostaIA from "@/pages/GerarPropostaIA";
import Configuracoes from "@/pages/Configuracoes";
import Organizacao from "@/pages/Organizacao";
import Admin from "@/pages/Admin";
import NovaPropostaAvancada from "@/pages/advanced/NovaPropostaAvancada";
import PreencherProposta from "@/pages/advanced/PreencherProposta";
import RevisaoProposta from "@/pages/advanced/RevisaoProposta";
import BrandProfilePage from "@/pages/advanced/BrandProfilePage";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound.tsx";
import AcceptInvite from "@/pages/AcceptInvite";
import TenantDetailPage from "@/pages/TenantDetailPage";

export const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/accept" element={<AcceptInvite />} />

            {/* Protected app */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/catalogo" element={<Catalogo />} />
                      <Route path="/propostas" element={<Propostas />} />
                      <Route path="/propostas-avancadas" element={<PropostasAvancadas />} />
                      <Route path="/proposta/nova" element={<CriarProposta />} />
                      <Route path="/proposta/editar/:id" element={<CriarProposta />} />
                      <Route path="/proposta/:id" element={<ResumoProposta />} />
                      <Route path="/proposta/:id/gerar-ia" element={<GerarPropostaIA />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route path="/organizacao" element={<Organizacao />} />
                      {/* P1-H11: Admin routes wrapped with role guard */}
                      <Route
                        path="/admin/*"
                        element={
                          <ProtectedRoute roles={['admin']} fallbackPath="/">
                            <Routes>
                              <Route path="/admin/tenants/:id" element={<TenantDetailPage />} />
                              <Route path="/admin" element={<Admin />} />
                            </Routes>
                          </ProtectedRoute>
                        }
                      />
                      {/* Advanced Proposals */}
                      <Route path="/proposta-avancada/nova" element={<NovaPropostaAvancada />} />
                      <Route path="/proposta-avancada/:id" element={<PreencherProposta />} />
                      <Route path="/revisao-proposta/:id" element={<RevisaoProposta />} />
                      <Route path="/brand-profile" element={<BrandProfilePage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
