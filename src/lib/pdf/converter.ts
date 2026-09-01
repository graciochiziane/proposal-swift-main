// ============================================================
// Geração de Propostas em PDF — Conversores
//
// Três origens convergem no modelo DadosPropostaPdf:
//   1. Cotação (Proposta + Cliente + DonoProposta) — ResumoProposta
//   2. Narrativa IA (seccões geradas) — GerarPropostaIA (Doc A)
//   3. Proposta avançada (ProposalDocument) — RevisaoProposta
// ============================================================

import type { Cliente, DonoProposta, Proposta } from '@/types';
import { calcularTotal } from '@/lib/calculos';
import { SECTION_LABELS } from '@/lib/seccoes';
import type { DadosPropostaPdf, PagamentoPdf, SecaoPdf, TotaisPdf } from './tipos';
import type { ProposalDocument } from '@/lib/advanced/documentModel';

// ---- helpers ----

function calcularTotais(proposta: Proposta): TotaisPdf {
  const totais = calcularTotal(
    proposta.subtotal,
    proposta.descontoTipo,
    proposta.descontoValor,
    proposta.ivaPercentual,
  );
  const descontoLabel = proposta.descontoTipo === 'percentual'
    ? `${proposta.descontoValor}%`
    : undefined;
  return {
    subtotal: proposta.subtotal,
    desconto: totais.desconto,
    descontoLabel,
    iva: totais.iva,
    ivaPercentual: proposta.ivaPercentual,
    total: totais.total,
  };
}

function extrairPagamento(dono: DonoProposta): PagamentoPdf | undefined {
  const banco = dono.dadosBancarios;
  const mm = dono.mobileMoney;
  const pagamento: PagamentoPdf = {
    banco: banco?.ativo ? banco.banco : undefined,
    conta: banco?.ativo ? banco.numeroConta : undefined,
    nib: banco?.ativo ? banco.nib : undefined,
    mpesa: mm?.mpesa?.ativo ? mm.mpesa.numero : undefined,
    emola: mm?.emola?.ativo ? mm.emola.numero : undefined,
    mkesh: mm?.mkesh?.ativo ? mm.mkesh.numero : undefined,
  };
  return Object.values(pagamento).some(Boolean) ? pagamento : undefined;
}

/**
 * Converte o record de seccoes da IA (respeitando os toggles do
 * utilizador) em secções ordenadas para o PDF.
 */
export function seccoesParaPdf(
  seccoes: Record<string, string>,
  includedSections?: Record<string, boolean>,
): SecaoPdf[] {
  const ordemCanonica = Object.keys(SECTION_LABELS);
  const resultado: SecaoPdf[] = [];

  const incluida = (key: string): boolean =>
    !(includedSections && includedSections[key] === false);

  const push = (key: string): void => {
    const texto = seccoes[key]?.trim();
    if (texto && incluida(key)) {
      resultado.push({ titulo: SECTION_LABELS[key] ?? key, conteudo: texto });
    }
  };

  for (const key of ordemCanonica) push(key);
  for (const key of Object.keys(seccoes)) {
    if (!ordemCanonica.includes(key)) push(key);
  }
  return resultado;
}

// ---- 1. Cotação (ResumoProposta) ----

/**
 * Dados para a cotação completa: capa + tabela de itens + totais
 * (+ secções narrativas opcionais, ex.: quando já existe narrativa IA).
 */
export function construirDadosPdf(
  proposta: Proposta,
  cliente: Cliente | undefined | null,
  dono: DonoProposta | undefined | null,
  opcoes?: { seccoes?: SecaoPdf[] },
): DadosPropostaPdf {
  return {
    titulo: 'Proposta Comercial',
    numero: proposta.numero || 'S/N',
    data: proposta.data,
    validadeDias: 15,
    cliente: {
      nome: cliente?.nome || proposta.clienteSnapshot?.nome || 'Cliente',
      empresa: cliente?.empresa || proposta.clienteSnapshot?.empresa || undefined,
      nuit: cliente?.nuit || proposta.clienteSnapshot?.nuit || undefined,
      email: cliente?.email || proposta.clienteSnapshot?.email || undefined,
      telefone: cliente?.telefone || proposta.clienteSnapshot?.telefone || undefined,
      endereco: cliente?.endereco || proposta.clienteSnapshot?.endereco || undefined,
    },
    empresa: {
      nome: dono?.empresa || dono?.nome || 'PropostaJá',
      nuit: dono?.nuit || undefined,
      endereco: dono?.endereco || undefined,
      email: dono?.email || undefined,
      telefone: dono?.telefone || dono?.contacto || undefined,
      logotipo: dono?.logotipo || undefined,
      corPrimaria: dono?.corPrimaria || undefined,
    },
    itens: (proposta.itens || []).map(item => ({
      nome: item.nome,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
      subtotal: item.subtotal,
    })),
    mostrarFinanceiro: true,
    totais: calcularTotais(proposta),
    seccoes: opcoes?.seccoes ?? [],
    observacoes: proposta.observacoes || undefined,
    pagamento: dono ? extrairPagamento(dono) : undefined,
  };
}

// ---- 2. Narrativa IA (GerarPropostaIA — Doc A) ----

/**
 * Doc A: proposta narrativa sem tabela financeira (a cotação é
 * gerada à parte no Resumo da Proposta).
 */
export function construirDadosNarrativaPdf(
  proposta: Proposta,
  dono: DonoProposta,
  seccoes: Record<string, string>,
  includedSections?: Record<string, boolean>,
): DadosPropostaPdf {
  const base = construirDadosPdf(proposta, null, dono, {
    seccoes: seccoesParaPdf(seccoes, includedSections),
  });
  return {
    ...base,
    titulo: 'Proposta Comercial',
    mostrarFinanceiro: false,
    observacoes: undefined, // no Doc A as condições vivem nas secções
    pagamento: undefined,
  };
}

// ---- 3. Proposta avançada (RevisaoProposta) ----

/**
 * Converte o modelo do fluxo avançado (ProposalDocument) para o
 * PDF. Secções "cover" são ignoradas — a capa é sempre desenhada
 * pelo template.
 */
export function converterDocumentoAvancado(doc: ProposalDocument): DadosPropostaPdf {
  const seccoes: SecaoPdf[] = doc.sections
    .filter(s => s.type !== 'cover' && (s.content || '').trim().length > 0)
    .sort((a, b) => a.order - b.order)
    .map(s => ({ titulo: s.title, conteudo: s.content }));

  return {
    titulo: 'Proposta Comercial',
    numero: doc.metadata.proposalId?.slice(0, 8) || 'S/N',
    data: doc.metadata.generatedAt,
    validadeDias: 15,
    cliente: {
      nome: doc.metadata.clientName || 'Cliente',
      empresa: doc.metadata.clientCompany || undefined,
      email: doc.metadata.clientEmail || undefined,
      telefone: doc.metadata.clientPhone || undefined,
    },
    empresa: {
      nome: doc.metadata.companyName || 'PropostaJá',
      nuit: doc.metadata.companyNuit || undefined,
      endereco: doc.metadata.companyAddress || undefined,
      telefone: doc.metadata.companyContact || undefined,
      logotipo: doc.metadata.companyLogo || undefined,
      corPrimaria: doc.brand?.primaryColor || undefined,
    },
    itens: [],
    mostrarFinanceiro: false,
    totais: { subtotal: 0, desconto: 0, iva: 0, ivaPercentual: 0, total: 0 },
    seccoes,
  };
}
