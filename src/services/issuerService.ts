import { supabase } from '@/integrations/supabase/client';
import { ProfileService } from './profileService';
import { OrganizationService } from './organizationService';
import type { DonoProposta, PagamentoExtra } from '@/types';

// ============================================================
// IssuerService — monta os dados do EMISSOR de uma proposta.
//
// Arquitectura SaaS (split perfil pessoal vs organização):
//   - Nome/Cargo/Contacto  → profiles do utilizador autenticado
//   - Empresa/NUIT/Endereço/Logo/Cor/Pagamentos → organizations
//
// FALLBACK (rede de segurança pré-migração / org sem dados):
//   cada campo da org só prevalece quando está preenchido;
//   caso contrário usa-se o valor do perfil pessoal (legado).
//   Sem organização activa → 100% perfil (comportamento antigo).
//
// Este objecto alimenta os 3 modelos de PDF (converter.ts) sem
// alterar o tipo DonoProposta — zero mudanças no motor de PDF.
// ============================================================

type BlocoBancario = DonoProposta['dadosBancarios'];
type BlocoMobile = DonoProposta['mobileMoney'];

/** Block bancário "significativo" = activo ou algum campo preenchido. */
function bancoSignificativo(b: BlocoBancario | null | undefined): boolean {
  if (!b) return false;
  return b.ativo === true
    || !!b.banco?.trim()
    || !!b.numeroConta?.trim()
    || !!b.nib?.trim();
}

/** Mobile money "significativo" = qualquer operadora activa ou com número. */
function mobileSignificativo(m: BlocoMobile | null | undefined): boolean {
  if (!m) return false;
  return [m.mpesa, m.emola, m.mkesh].some(
    p => p?.ativo === true || !!p?.numero?.trim()
  );
}

function extrasSignificativos(e: PagamentoExtra[] | null | undefined): boolean {
  return Array.isArray(e) && e.length > 0;
}

export const IssuerService = {
  /**
   * Devolve os dados do emissor para gerar propostas:
   * herda Nome/Cargo do utilizador autenticado e
   * Logo/Pagamentos/identidade fiscal da organização activa.
   */
  async getIssuer(): Promise<DonoProposta | null> {
    const [profile, orgId] = await Promise.all([
      ProfileService.getProfile(),
      OrganizationService.getOrgIdForInsert(),
    ]);

    // Sem organização → comportamento antigo (perfil pessoal completo)
    if (!orgId) return profile;

    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (error || !org) {
      console.warn('[IssuerService] Org activa não carregada, a usar perfil:', error?.message);
      return profile;
    }

    // Logo da org (signed URL); '' quando não existe/assinatura falha
    const logoOrg = await OrganizationService.signOrgLogoUrl(org.logo_url, org.id);

    // Blocos de pagamento da org — só quando significativos;
    // caso contrário preserva-se o fallback do perfil pessoal.
    const bancoOrg = bancoSignificativo(org.dados_bancarios as unknown as BlocoBancario)
      ? (org.dados_bancarios as unknown as BlocoBancario)
      : null;
    const mobileOrg = mobileSignificativo(org.mobile_money as unknown as BlocoMobile)
      ? (org.mobile_money as unknown as BlocoMobile)
      : null;
    const extrasOrg = extrasSignificativos(org.pagamentos_extras as unknown as PagamentoExtra[])
      ? (org.pagamentos_extras as unknown as PagamentoExtra[])
      : null;

    // Sem perfil (edge: auth sem row em profiles) → construir só com a org
    if (!profile) {
      return {
        nome: '',
        cargo: '',
        empresa: org.nome || '',
        contacto: '',
        email: org.contact_email || undefined,
        nuit: org.nuit || '',
        endereco: org.endereco || '',
        logotipo: logoOrg,
        corPrimaria: org.cor_primaria || '#0B5394',
        dadosBancarios: bancoOrg ?? { ativo: false, banco: '', numeroConta: '', nib: '' },
        mobileMoney: mobileOrg ?? {
          mpesa: { ativo: false, numero: '' },
          emola: { ativo: false, numero: '' },
          mkesh: { ativo: false, numero: '' },
        },
        pagamentosExtras: extrasOrg ?? [],
      };
    }

    // MERGE: dados pessoais do utilizador + dados da empresa (org),
    // com fallback para o perfil legado em cada campo da org vazio.
    return {
      nome: profile.nome,          // pessoal — herda do utilizador autenticado
      cargo: profile.cargo,         // pessoal
      contacto: profile.contacto,   // pessoal
      email: profile.email || org.contact_email || undefined, // pessoal → org
      empresa: org.nome || profile.empresa,
      nuit: org.nuit || profile.nuit,
      endereco: org.endereco || profile.endereco,
      logotipo: logoOrg || profile.logotipo,
      corPrimaria: org.cor_primaria || profile.corPrimaria,
      dadosBancarios: bancoOrg ?? profile.dadosBancarios,
      mobileMoney: mobileOrg ?? profile.mobileMoney,
      pagamentosExtras: extrasOrg ?? profile.pagamentosExtras ?? [],
    };
  },
};
