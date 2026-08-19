// ============================================================
// CrmGate — Feature gate para páginas CRM Business
//
// Mostra upgrade CTA se o utilizador não tem crm_access.
// P1-FIX: 6 páginas CRM não verificavam crm_access — agora todas usam este gate.
// ============================================================

import { useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function CrmGate({ children }: { children: React.ReactNode }) {
  const { hasFeature, loading } = usePlanFeatures();
  const navigate = useNavigate();

  // While loading, assume access (defensive default — avoids flicker)
  if (loading) return <>{children}</>;

  if (!hasFeature('crm_access')) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10 mx-auto w-fit">
              <TrendingUp className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Vendas exclusiva do plano Business</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Transforme os seus contactos em oportunidades de venda. Acompanhe propostas,
              follow-ups, oportunidades e histórico comercial num só lugar.
            </p>
            <Button onClick={() => navigate('/organizacao')} className="gap-2">
              Conhecer Business
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
