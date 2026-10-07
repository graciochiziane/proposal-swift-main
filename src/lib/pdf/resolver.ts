// ============================================================
// Resolver de Template por Organização
//
// Único ponto de decisão entre a organização activa e o
// modelo PDF efectivo (proposta auditada, Secção 4).
//
// Contrato funcional:
//   1. recebe o orgId e o fallback que o chamador usaria hoje;
//   2. consulta (via função injectada) a linha default ACTIVA
//      da org em organization_templates — filtrada por RLS
//      (org alheia devolve 0 linhas = fallback);
//   3. valida a chave devolvida contra o registry TEMPLATES_PDF
//      em código — chave órfã (modelo removido em deploy
//      posterior) degrada para o fallback, nunca para erro;
//   4. qualquer falha de rede/Supabase devolve o fallback;
//   5. NUNCA lança excepções e nunca faz mais do que uma
//      query leve.
//
// Precedência resultante (documentada):
//   proposta (selector do utilizador) > organização (default
//   activo) > preferência individual (localStorage) > hardcoded.
//
// Este ficheiro é PURO (zero dependência de Supabase) — os
// testes unitários injectam a consulta (sem rede).
// ============================================================

import type { PdfTemplateId } from './tipos';
import { TEMPLATES_PDF } from './templates';

/**
 * Consulta a chave do template default da org.
 * Devolve null quando a org não tem linha default activa
 * (ou quando o caller não tem permissão para a ver — RLS).
 * Nunca lança; qualquer falha conta como "sem linha".
 */
export type ConsultadorTemplateOrg = (organizationId: string) => Promise<string | null | undefined>;

/** Chaves válidas do registry em código (executivo|editorial|cotacao|minimal) */
const CHAVES_REGISTADAS: ReadonlySet<string> = new Set(TEMPLATES_PDF.map(t => t.id));

/** Verifica se uma chave existe no registry (guarda de chave órfã) */
export function chaveTemplateRegistada(chave: string | null | undefined): chave is PdfTemplateId {
  return typeof chave === 'string' && CHAVES_REGISTADAS.has(chave);
}

/**
 * Resolve o template efectivo para a organização activa.
 *
 * - Sem orgId (utilizador sem organização) → fallback directo, sem query.
 * - Org com default activo válido → chave da org.
 * - Org sem linhas / default inactivo / chave órfã / erro → fallback
 *   (idêntico ao comportamento pré-resolver).
 */
export async function resolverTemplateParaOrg(
  organizationId: string | null | undefined,
  fallback: PdfTemplateId,
  consultarTemplateOrg?: ConsultadorTemplateOrg,
): Promise<PdfTemplateId> {
  if (!organizationId || !consultarTemplateOrg) return fallback;
  try {
    const chave = await consultarTemplateOrg(organizationId);
    return chaveTemplateRegistada(chave) ? chave : fallback;
  } catch {
    // Nunca lança: erro de rede/Supabase → comportamento actual.
    return fallback;
  }
}
