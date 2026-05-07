import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import Catalogo from "@/pages/Catalogo";
import CriarProposta from "@/pages/CriarProposta";
import Propostas from "@/pages/Propostas";
import ResumoProposta from "@/pages/ResumoProposta";
import GerarPropostaIA from "@/pages/GerarPropostaIA";
import Configuracoes from "@/pages/Configuracoes";
import Admin from "@/pages/Admin";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

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
                      <Route path="/proposta/nova" element={<CriarProposta />} />
                      <Route path="/proposta/editar/:id" element={<CriarProposta />} />
                      <Route path="/proposta/:id" element={<ResumoProposta />} />
                      <Route path="/proposta/:id/gerar-ia" element={<GerarPropostaIA />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
