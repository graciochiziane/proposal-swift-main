// ============================================================
// Proposta Narrativa HTML (Doc A — Proposta Comercial)
//
// Substitui o antigo gerador jsPDF (lib/pdf/narrativa.ts).
// Gera um documento HTML autónomo com a narrativa IA:
//   - Cabeçalho com marca (cor primária + logotipo)
//   - Bloco Emitente / Cliente
//   - Secções narrativas (markdown → HTML seguro)
//   - Rodapé com dados da empresa
//   - Print CSS A4 + botão "Imprimir / Guardar PDF"
//
// XSS: o conteúdo IA passa por escapeHtml + markdownToHtml
// (P0-C5, ver lib/advanced/documentModel) — nenhum HTML
// cru do utilizador entra no documento sem escape.
// ============================================================

import type { Proposta, DonoProposta } from '@/types';
import { markdownToHtml } from '@/lib/advanced/documentModel';
import { wrapHtmlDocument } from './htmlDocument';

// ---- Types ----

export interface HtmlNarrativeSection {
  titulo: string;
  texto: string;
}

// ---- Secções: seccoes record → secções ordenadas ----

/**
 * Converte um record de seccoes (output da IA) em
 * NarrativeSection[] ordenadas. Respeita os toggles do
 * utilizador (includedSections[key] === false omite).
 */
export function seccoesToNarrative(
  seccoes: Record<string, string>,
  labels?: Record<string, string>,
  includedSections?: Record<string, boolean>,
): HtmlNarrativeSection[] {
  const defaultLabels: Record<string, string> = {
    contexto: 'Contexto do Cliente',
    problema: 'Problema Identificado',
    solucao: 'Solucao Proposta',
    beneficios: 'Beneficios Esperados',
    impacto: 'Impacto Quantificavel',
    escopo: 'Escopo Detalhado',
    cronograma: 'Cronograma',
    condicoes: 'Condicoes Especiais',
    investimento: 'Resumo de Investimento',
  };

  const sectionLabels = labels ?? defaultLabels;
  const sections: HtmlNarrativeSection[] = [];

  // Manter a ordem canónica
  const orderedKeys = Object.keys(defaultLabels);
  for (const key of orderedKeys) {
    if (includedSections && includedSections[key] === false) continue;
    if (seccoes[key]?.trim()) {
      sections.push({
        titulo: sectionLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
        texto: seccoes[key],
      });
    }
  }

  // Chaves extra fora da ordem canónica
  for (const key of Object.keys(seccoes)) {
    if (includedSections && includedSections[key] === false) continue;
    if (!defaultLabels[key] && seccoes[key]?.trim()) {
      sections.push({
        titulo: sectionLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
        texto: seccoes[key],
      });
    }
  }

  return sections;
}

// ---- Cronograma: markers → tabela markdown ----

const CRONO_TABLE_START = 'TABELA_CRONOGRAMA_INICIO';
const CRONO_TABLE_END = 'TABELA_CRONOGRAMA_FIM';

/**
 * Remove os markers de cronograma: as linhas | tabela |
 * dentro deles são convertidas pelo markdownToHtml.
 */
function stripCronogramaMarkers(text: string): string {
  return text
    .replace(CRONO_TABLE_START, '')
    .replace(CRONO_TABLE_END, '');
}

// ---- Utilities ----

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexToRgb(hex: string): [number, number, number] {
  const color = (hex || '#0B5394').replace('#', '');
  const num = parseInt(color.length === 3
    ? color.split('').map(c => c + c).join('')
    : color, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c * (1 - factor));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// ---- Main render ----

/**
 * Gera a Proposta Comercial (Doc A) como documento HTML
 * autónomo. Contém APENAS a narrativa IA — sem tabela de
 * itens nem totais (a cotação financeira é o Doc B, gerado
 * a partir do Resumo da Proposta com templates HTML).
 */
export function gerarHtmlNarrativa(
  proposta: Proposta,
  dono: DonoProposta,
  seccoes: Record<string, string>,
  includedSections?: Record<string, boolean>,
): string {
  const primary = dono.corPrimaria || '#0B5394';
  const cliente = proposta.clienteSnapshot;
  const narrative = seccoesToNarrative(seccoes, undefined, includedSections);
  const empresaNome = dono.empresa || dono.nome || 'PropostaJa';
  const dataStr = new Date(proposta.data).toLocaleDateString('pt-MZ');

  const logoHtml = dono.logotipo
    ? `<img src="${escapeHtml(dono.logotipo)}" alt="${escapeHtml(empresaNome)}" class="narr-logo" />`
    : `<div class="narr-company">${escapeHtml(empresaNome)}</div>`;

  // ---- Emitente / Cliente ----
  const emitenteLinhas = [
    dono.endereco,
    dono.nuit ? `NUIT: ${dono.nuit}` : '',
    dono.contacto,
    dono.nome && dono.empresa ? dono.nome : '',
    dono.cargo,
  ].filter(Boolean) as string[];

  const clienteLinhas = [
    cliente?.empresa,
    cliente?.nuit ? `NUIT: ${cliente.nuit}` : '',
    cliente?.endereco,
    cliente?.email,
    cliente?.telefone,
  ].filter(Boolean) as string[];

  const infoBlockHtml = `
  <div class="narr-info">
    <div class="narr-info-col">
      <div class="narr-info-label">EMITENTE</div>
      <div class="narr-info-name">${escapeHtml(empresaNome)}</div>
      ${emitenteLinhas.map(l => `<p>${escapeHtml(l)}</p>`).join('\n      ')}
    </div>
    <div class="narr-info-col">
      <div class="narr-info-label">CLIENTE</div>
      <div class="narr-info-name">${escapeHtml(cliente?.nome || 'N/A')}</div>
      ${clienteLinhas.map(l => `<p>${escapeHtml(l)}</p>`).join('\n      ')}
    </div>
  </div>`;

  // ---- Secções narrativas ----
  const sectionsHtml = narrative.map(section => `
  <section class="narr-section">
    <h2>${escapeHtml(section.titulo)}</h2>
    <div class="narr-content">
      ${markdownToHtml(stripCronogramaMarkers(section.texto))}
    </div>
  </section>`).join('\n');

  // ---- Documento completo ----
  const fragment = `
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Inter", "Segoe UI", Arial, sans-serif;
    color: #1e293b; background: #ffffff;
    font-size: 11pt; line-height: 1.7;
  }
  .narr-doc { max-width: 186mm; margin: 0 auto; padding: 12mm 0 16mm; }

  /* Header */
  .narr-header { border-bottom: 3px solid ${primary}; padding-bottom: 1.2rem; margin-bottom: 1.4rem; }
  .narr-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .narr-logo { max-height: 56px; max-width: 180px; object-fit: contain; }
  .narr-company { font-size: 17pt; font-weight: 700; color: ${primary}; }
  .narr-subtitle { font-size: 8.5pt; letter-spacing: 2px; color: #64748b; text-transform: uppercase; margin-top: 0.35rem; }
  .narr-badge {
    background: ${primary}; color: #ffffff; text-align: right;
    padding: 0.6rem 1rem; border-radius: 6px; min-width: 150px;
  }
  .narr-badge .num { font-size: 11pt; font-weight: 700; }
  .narr-badge .meta { font-size: 8pt; opacity: 0.9; margin-top: 2px; }

  /* Emitente / Cliente */
  .narr-info { display: flex; gap: 2rem; margin: 1.4rem 0 0; }
  .narr-info-col { flex: 1; }
  .narr-info-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 1.5px; color: ${primary}; }
  .narr-info-name { font-size: 11pt; font-weight: 700; margin: 0.2rem 0 0.15rem; }
  .narr-info-col p { margin: 0.1rem 0; font-size: 9pt; color: #475569; }

  /* Separator */
  .narr-sep { margin: 1.2rem 0 0.4rem; border-bottom: 1px solid #e2e8f0; position: relative; }
  .narr-sep::before { content: ''; position: absolute; left: 0; top: -2px; width: 30px; height: 2.5px; background: ${primary}; }

  /* Secções */
  .narr-section { margin-top: 1.6rem; page-break-inside: avoid; }
  .narr-section h2 {
    font-size: 13pt; font-weight: 700; color: ${primary};
    padding-bottom: 0.3rem; border-bottom: 1px solid ${lighten(primary, 0.85)};
    margin: 0 0 0.7rem;
  }
  .narr-content p { margin: 0 0 0.55rem; text-align: justify; }
  .narr-content h2, .narr-content h3 { margin: 0.8rem 0 0.4rem; }
  .narr-content ul, .narr-content ol { margin: 0.4rem 0 0.6rem 1.4rem; }
  .narr-content li { margin-bottom: 0.25rem; }
  .narr-content table { width: 100%; border-collapse: collapse; margin: 0.7rem 0; font-size: 9.5pt; page-break-inside: avoid; }
  .narr-content th { background: ${lighten(primary, 0.9)}; color: ${darken(primary, 0.25)}; text-align: left; padding: 6px 10px; border-bottom: 2px solid ${lighten(primary, 0.7)}; }
  .narr-content td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  .narr-content tr:nth-child(even) td { background: #f8fafc; }
  .narr-content code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 9.5pt; }
  .missing-info { background: #fef3c7; color: #92400e; padding: 1px 7px; border-radius: 3px; font-weight: 500; }

  /* Footer */
  .narr-footer {
    margin-top: 2.2rem; padding-top: 0.9rem; border-top: 1px solid #e2e8f0;
    font-size: 8pt; color: #94a3b8; text-align: center;
  }
  .narr-footer .brand { font-weight: 700; color: ${primary}; }

  @media print {
    .narr-doc { max-width: none; padding: 0; }
  }
</style>

<div class="narr-doc">
  <div class="narr-header">
    <div class="narr-header-top">
      <div>
        ${logoHtml}
        <div class="narr-subtitle">Proposta Comercial</div>
      </div>
      <div class="narr-badge">
        <div class="num">N. ${escapeHtml(proposta.numero || '')}</div>
        <div class="meta">${dataStr}</div>
        <div class="meta">${narrative.length} seccoes</div>
      </div>
    </div>
  </div>

  ${cliente ? infoBlockHtml : ''}
  <div class="narr-sep"></div>

  ${sectionsHtml}

  <div class="narr-footer">
    <p><span class="brand">${escapeHtml(empresaNome)}</span>${dono.nuit ? ` | NUIT: ${escapeHtml(dono.nuit)}` : ''}${dono.endereco ? ` | ${escapeHtml(dono.endereco)}` : ''}</p>
    <p>Proposta preparada para <strong>${escapeHtml(cliente?.nome || '')}</strong>${cliente?.empresa ? ` — ${escapeHtml(cliente.empresa)}` : ''}</p>
    <p>Gerado em ${dataStr} · Documento HTML — imprimir ou guardar como PDF via browser</p>
  </div>
</div>`;

  return wrapHtmlDocument(fragment, `Proposta-${proposta.numero || 'IA'}`);
}
