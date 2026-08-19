import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { CrmGate } from "@/components/crm/CrmGate";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// FASE 8: Code splitting — lazy load all pages for smaller initial bundle
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const Catalogo = lazy(() => import("@/pages/Catalogo"));
const CriarProposta = lazy(() => import("@/pages/CriarProposta"));
const Propostas = lazy(() => import("@/pages/Propostas"));
const PropostasAvancadas = lazy(() => import("@/pages/PropostasAvancadas"));
const ResumoProposta = lazy(() => import("@/pages/ResumoProposta"));
const GerarPropostaIA = lazy(() => import("@/pages/GerarPropostaIA"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const Organizacao = lazy(() => import("@/pages/Organizacao"));
const Admin = lazy(() => import("@/pages/Admin"));
const NovaPropostaAvancada = lazy(() => import("@/pages/advanced/NovaPropostaAvancada"));
const PreencherProposta = lazy(() => import("@/pages/advanced/PreencherProposta"));
const RevisaoProposta = lazy(() => import("@/pages/advanced/RevisaoProposta"));
const BrandProfilePage = lazy(() => import("@/pages/advanced/BrandProfilePage"));
const CRMDashboard = lazy(() => import("@/pages/crm/CRMDashboard"));
const CRMContactos = lazy(() => import("@/pages/crm/CRMContactos"));
const ClienteDetalhe = lazy(() => import("@/pages/crm/ClienteDetalhe"));
const Pipeline = lazy(() => import("@/pages/crm/Pipeline"));
const Actividades = lazy(() => import("@/pages/crm/Actividades"));
const FollowUps = lazy(() => import("@/pages/crm/FollowUps"));
const Insights = lazy(() => import("@/pages/crm/Insights"));
const Auth = lazy(() => import("@/pages/Auth"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const TenantDetailPage = lazy(() => import("@/pages/TenantDetailPage"));

export const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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
            <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
            <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
            <Route path="/invite/accept" element={<Suspense fallback={<PageLoader />}><AcceptInvite /></Suspense>} />

            {/* Protected app */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Suspense fallback={<PageLoader />}>
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
                      {/* Admin routes */}
                      <Route path="/admin/tenants/:id" element={<TenantDetailPage />} />
                      <Route path="/admin" element={<Admin />} />
                      {/* Advanced Proposals */}
                      <Route path="/proposta-avancada/nova" element={<NovaPropostaAvancada />} />
                      <Route path="/proposta-avancada/:id" element={<PreencherProposta />} />
                      <Route path="/revisao-proposta/:id" element={<RevisaoProposta />} />
                      <Route path="/brand-profile" element={<BrandProfilePage />} />
                      {/* CRM — Business only (CrmGate wraps all /crm/* routes) */}
                      <Route path="/crm/*" element={<CrmGate><Routes>
                        <Route path="/crm" element={<CRMDashboard />} />
                        <Route path="/crm/contactos" element={<CRMContactos />} />
                        <Route path="/crm/contactos/:id" element={<ClienteDetalhe />} />
                        <Route path="/crm/pipeline" element={<Pipeline />} />
                        <Route path="/crm/actividades" element={<Actividades />} />
                        <Route path="/crm/follow-ups" element={<FollowUps />} />
                        <Route path="/crm/insights" element={<Insights />} />
                      </Routes></CrmGate>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </Suspense>
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
