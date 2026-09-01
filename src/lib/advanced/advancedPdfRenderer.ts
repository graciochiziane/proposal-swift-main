// ============================================================
// Advanced Proposal HTML Renderer
// Gera HTML completo com estilos print-ready
// 4 templates: corporate, premium, minimal, technical
//
// HTML é o único formato de geração: o documento é
// autónomo e o PDF obtém-se via Imprimir do browser.
// ============================================================

import type { ProposalDocument, DocSection } from './documentModel';
import { markdownToHtml } from './documentModel';

const FONT_MAP: Record<string, string> = {
  inter: '"Inter", "Segoe UI", system-ui, sans-serif',
  roboto: '"Roboto", "Segoe UI", system-ui, sans-serif',
  lato: '"Lato", "Segoe UI", system-ui, sans-serif',
  merriweather: '"Merriweather", Georgia, serif',
  playfair: '"Playfair Display", Georgia, serif',
};

// ============================================================
// Style presets per visual style
// ============================================================

interface StylePreset {
  headingWeight: string;
  sectionSpacing: string;
  coverStyle: string;
  sectionHeaderStyle: string;
  footerStyle: string;
  extraCSS: string;
}

function getStylePreset(vs: string, pc: string, ac: string): StylePreset {
  switch (vs) {
    case 'premium':
      return {
        headingWeight: '600',
        sectionSpacing: '3rem',
        coverStyle: `
          .cover {
            min-height: 92vh; display: flex; flex-direction: column;
            justify-content: center; align-items: center; text-align: center;
            background: linear-gradient(160deg, ${pc} 0%, ${adjustColor(pc, -40)} 50%, ${adjustColor(pc, -60)} 100%);
            color: white; padding: 4rem; border-radius: 0; margin-bottom: 0;
            position: relative; overflow: hidden;
          }
          .cover::before {
            content: ''; position: absolute; top: -50%; right: -50%;
            width: 100%; height: 100%; border-radius: 50%;
            background: rgba(255,255,255,0.05);
          }
          .cover h1 { font-size: 30pt; font-weight: 300; letter-spacing: 1px; margin-bottom: 1.5rem; }
          .cover .subtitle { font-size: 13pt; opacity: 0.85; letter-spacing: 0.5px; }
          .cover .date { font-size: 11pt; opacity: 0.6; margin-top: 2.5rem; letter-spacing: 2px; text-transform: uppercase; }
          .cover .company-logo { max-width: 100px; max-height: 70px; margin-bottom: 2.5rem; filter: brightness(0) invert(1); }
          .cover .divider { width: 60px; height: 2px; background: rgba(255,255,255,0.4); margin: 1.5rem auto; }
        `,
        sectionHeaderStyle: `
          .section-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 1.2rem; }
          .section-number { font-size: 28pt; font-weight: 300; color: ${ac}40; line-height: 1; }
          .section-title { font-size: 17pt; font-weight: 600; color: ${pc}; }
          .section-header::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, ${pc}30, transparent); }
        `,
        footerStyle: `
          .doc-footer { margin-top: 4rem; padding: 2rem 0; border-top: 1px solid ${pc}20; text-align: center; }
        `,
        extraCSS: `
          .doc-section { margin-bottom: 3rem; }
          .section-content p { text-align: left; line-height: 1.8; }
        `,
      };
    case 'minimal':
      return {
        headingWeight: '500',
        sectionSpacing: '2rem',
        coverStyle: `
          .cover {
            min-height: 80vh; display: flex; flex-direction: column;
            justify-content: flex-end; align-items: flex-start;
            padding: 4rem; margin-bottom: 3rem;
            background: white; color: #1e293b; border-left: 4px solid ${pc};
          }
          .cover h1 { font-size: 26pt; font-weight: 500; margin-bottom: 0.8rem; color: ${pc}; }
          .cover .subtitle { font-size: 12pt; color: #64748b; }
          .cover .date { font-size: 11pt; color: #94a3b8; margin-top: 1.5rem; }
          .cover .company-logo { max-width: 80px; max-height: 60px; margin-bottom: 3rem; }
        `,
        sectionHeaderStyle: `
          .section-header { margin-bottom: 0.8rem; padding-bottom: 0.3rem; border-bottom: 1px solid #e2e8f0; }
          .section-number { display: none; }
          .section-title { font-size: 14pt; font-weight: 500; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; }
        `,
        footerStyle: `
          .doc-footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; text-align: left; font-size: 8pt; }
        `,
        extraCSS: `
          .section-content p { text-align: left; color: #374151; }
          .section-content li { color: #374151; }
        `,
      };
    case 'technical':
      return {
        headingWeight: '700',
        sectionSpacing: '2rem',
        coverStyle: `
          .cover {
            min-height: 85vh; display: flex; flex-direction: column;
            justify-content: center; align-items: flex-start;
            padding: 3rem; margin-bottom: 2rem;
            background: #f8fafc; color: #0f172a;
            border: 2px solid ${pc}30;
          }
          .cover .cover-badge {
            display: inline-block; padding: 4px 12px; border-radius: 4px;
            background: ${pc}15; color: ${pc}; font-size: 10pt; font-weight: 600;
            text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.5rem;
          }
          .cover h1 { font-size: 24pt; font-weight: 700; margin-bottom: 0.8rem; }
          .cover .subtitle { font-size: 12pt; color: #475569; line-height: 1.6; }
          .cover .date { font-size: 10pt; color: #94a3b8; margin-top: 2rem; font-family: monospace; }
          .cover .company-logo { max-width: 80px; max-height: 60px; position: absolute; top: 2rem; right: 2rem; }
          .cover .meta-row { display: flex; gap: 2rem; margin-top: 1rem; font-size: 10pt; color: #64748b; }
        `,
        sectionHeaderStyle: `
          .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 0.8rem; }
          .section-number {
            font-size: 9pt; font-weight: 700; color: white;
            min-width: 24px; height: 24px; display: flex; align-items: center;
            justify-content: center; border-radius: 4px; background: ${pc};
          }
          .section-title { font-size: 14pt; font-weight: 700; color: #0f172a; }
          .section-header::after { content: ''; flex: 1; height: 2px; background: #e2e8f0; }
        `,
        footerStyle: `
          .doc-footer { margin-top: 3rem; padding-top: 1rem; border-top: 2px solid ${pc}30; text-align: left; font-size: 8pt; font-family: monospace; }
        `,
        extraCSS: `
          .section-content code { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 1px 6px; font-family: 'JetBrains Mono', monospace; font-size: 9pt; }
          .section-content table { border: 1px solid #e2e8f0; }
          .section-content th { background: ${pc}10; border-bottom: 2px solid ${pc}40; }
        `,
      };
    default: // corporate
      return {
        headingWeight: '700',
        sectionSpacing: '2.5rem',
        coverStyle: `
          .cover {
            min-height: 90vh; display: flex; flex-direction: column;
            justify-content: center; align-items: center; text-align: center;
            background: linear-gradient(135deg, ${pc} 0%, ${adjustColor(pc, -30)} 100%);
            color: white; padding: 4rem; border-radius: 8px; margin-bottom: 2rem;
          }
          .cover h1 { font-size: 28pt; font-weight: 700; margin-bottom: 1rem; }
          .cover .subtitle { font-size: 14pt; opacity: 0.9; margin-bottom: 0.5rem; }
          .cover .date { font-size: 11pt; opacity: 0.7; margin-top: 2rem; }
          .cover .company-logo { max-width: 120px; max-height: 80px; margin-bottom: 2rem; border-radius: 8px; }
        `,
        sectionHeaderStyle: `
          .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 4px solid ${pc}; }
          .section-number { font-size: 10pt; font-weight: 700; color: ${ac}; min-width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: ${pc}15; }
          .section-title { font-size: 16pt; font-weight: 700; color: ${pc}; }
        `,
        footerStyle: `
          .doc-footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 2px solid ${pc}20; text-align: center; }
        `,
        extraCSS: '',
      };
  }
}

// ============================================================
// Main render function
// ============================================================

export function renderProposalHtml(doc: ProposalDocument): string {
  const font = FONT_MAP[doc.brand.fontPreference] || FONT_MAP.inter;
  const vs = doc.brand.visualStyle || 'corporate';
  const pc = doc.brand.primaryColor;
  const ac = doc.brand.accentColor;
  const preset = getStylePreset(vs, pc, ac);

  // Render cover as first section if no cover type exists
  const hasCover = doc.sections.some(s => s.type === 'cover');
  const contentSections = hasCover ? doc.sections : doc.sections;

  const sectionsHtml = contentSections.map(section => {
    if (section.type === 'cover') return renderCoverSection(section, doc, vs);
    return renderContentSection(section, doc, pc, ac);
  }).join('\n');

  // If no cover section, add a default cover
  const coverHtml = hasCover ? '' : renderDefaultCover(doc, vs, pc);

  const dateStr = new Date(doc.metadata.generatedAt).toLocaleDateString('pt-MZ', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="pt-MZ">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.metadata.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm 2.5cm;
      @bottom-center {
        content: "${escapeHtml(doc.metadata.companyName)} | Pagina " counter(page) " de " counter(pages);
        font-size: 9px;
        color: #94a3b8;
        font-family: ${font};
      }
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .doc-section { page-break-inside: avoid; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${font};
      font-size: 11pt;
      line-height: 1.7;
      color: #1e293b;
      background: white;
    }

    /* Cover styles */
    ${preset.coverStyle}

    /* Section styles */
    .doc-section {
      margin-bottom: ${preset.sectionSpacing};
      padding-bottom: ${preset.sectionSpacing};
      border-bottom: 1px solid #e2e8f0;
    }
    .doc-section:last-child { border-bottom: none; }
    ${preset.sectionHeaderStyle}

    /* Content typography */
    .section-content h2 { font-size: 13pt; color: ${pc}; margin: 1rem 0 0.5rem; }
    .section-content h3 { font-size: 11.5pt; color: #334155; margin: 0.8rem 0 0.4rem; }
    .section-content p { margin-bottom: 0.6rem; text-align: justify; }
    .section-content ul, .section-content ol { margin: 0.5rem 0 0.8rem 1.5rem; }
    .section-content li { margin-bottom: 0.3rem; }
    .section-content table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; font-size: 10pt; }
    .section-content thead { background: ${pc}10; }
    .section-content th { text-align: left; padding: 8px 12px; font-weight: 600; color: ${pc}; border-bottom: 2px solid ${pc}30; }
    .section-content td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    .section-content tr:nth-child(even) { background: #f8fafc; }
    .section-content code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
    .missing-info { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 3px; font-weight: 500; }

    /* Extra style-specific */
    ${preset.extraCSS}

    /* Footer */
    ${preset.footerStyle}
    .doc-footer .company-name { font-weight: 600; color: ${pc}; }

    /* Print button */
    .print-btn {
      position: fixed; top: 1rem; right: 1rem; padding: 10px 24px;
      background: ${pc}; color: white; border: none; border-radius: 8px;
      font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000;
    }
    .print-btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>

  <div class="document">
    ${coverHtml}
    ${sectionsHtml}
  </div>

  <div class="doc-footer">
    <p><span class="company-name">${escapeHtml(doc.metadata.companyName)}</span> | ${escapeHtml(doc.metadata.companyAddress || '')} | NUIT: ${escapeHtml(doc.metadata.companyNuit || '')}</p>
    <p style="margin-top:4px">Proposta preparada para <strong>${escapeHtml(doc.metadata.clientName)}</strong> - ${escapeHtml(doc.metadata.clientCompany)}</p>
    <p style="margin-top:4px">Gerado em ${dateStr}</p>
  </div>
</body>
</html>`;
}

// ============================================================
// Cover renderers
// ============================================================

function renderDefaultCover(doc: ProposalDocument, vs: string, _pc: string): string {
  const dateStr = new Date(doc.metadata.generatedAt).toLocaleDateString('pt-MZ', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const logoHtml = doc.metadata.companyLogo
    ? `<img src="${doc.metadata.companyLogo}" alt="Logo" class="company-logo" />`
    : '';

  if (vs === 'technical') {
    return `
    <div class="cover page-break">
      ${logoHtml}
      <div class="cover-badge">PROPOSTA COMERCIAL</div>
      <h1>${escapeHtml(doc.metadata.title)}</h1>
      <p class="subtitle">${escapeHtml(doc.metadata.blueprintName)}</p>
      <div class="meta-row">
        <span>Cliente: ${escapeHtml(doc.metadata.clientCompany)}</span>
        <span>Data: ${dateStr}</span>
      </div>
    </div>`;
  }

  if (vs === 'premium') {
    return `
    <div class="cover page-break">
      ${logoHtml}
      <div class="divider"></div>
      <h1>${escapeHtml(doc.metadata.title)}</h1>
      <p class="subtitle">${escapeHtml(doc.metadata.category)} &mdash; ${escapeHtml(doc.metadata.blueprintName)}</p>
      <p class="subtitle">Preparado para ${escapeHtml(doc.metadata.clientCompany)}</p>
      <div class="divider"></div>
      <p class="date">${dateStr}</p>
    </div>`;
  }

  if (vs === 'minimal') {
    return `
    <div class="cover page-break">
      ${logoHtml}
      <p class="subtitle">Proposta Comercial</p>
      <h1>${escapeHtml(doc.metadata.title)}</h1>
      <p class="subtitle">${escapeHtml(doc.metadata.clientName)} &mdash; ${escapeHtml(doc.metadata.clientCompany)}</p>
      <p class="date">${dateStr}</p>
    </div>`;
  }

  // Corporate default
  return `
  <div class="cover page-break">
    ${logoHtml}
    <h1>${escapeHtml(doc.metadata.title)}</h1>
    <p class="subtitle">${escapeHtml(doc.metadata.category)} - ${escapeHtml(doc.metadata.blueprintName)}</p>
    <p class="subtitle">Preparado para: ${escapeHtml(doc.metadata.clientCompany)}</p>
    <p class="date">${dateStr}</p>
  </div>`;
}

function renderCoverSection(section: DocSection, doc: ProposalDocument, vs: string): string {
  // If cover has AI content, use it; otherwise fall back to default
  if (section.content && section.content.trim().length > 20) {
    return renderDefaultCover(doc, vs, doc.brand.primaryColor);
  }
  return renderDefaultCover(doc, vs, doc.brand.primaryColor);
}

// ============================================================
// Content section renderer
// ============================================================

function renderContentSection(
  section: DocSection,
  _doc: ProposalDocument,
  _primaryColor: string,
  _accentColor: string,
): string {
  const htmlContent = markdownToHtml(section.content);

  return `
  <section class="doc-section">
    <div class="section-header">
      <span class="section-number">${section.order}</span>
      <h2 class="section-title">${escapeHtml(section.title)}</h2>
    </div>
    <div class="section-content">
      ${htmlContent}
    </div>
  </section>`;
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adjustColor(hex: string, amount: number): string {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Opens the rendered HTML in a new window
 * (preview + botão Imprimir embutido no documento).
 */
export function openHtmlPreview(doc: ProposalDocument): void {
  const html = renderProposalHtml(doc);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  URL.revokeObjectURL(url);
}

/**
 * Downloads the rendered proposal as a standalone .html file.
 */
export function downloadProposalHtml(doc: ProposalDocument): void {
  const html = renderProposalHtml(doc);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Proposta-${doc.metadata.title.replace(/[\\/:*?"<>|]/g, '').trim() || 'documento'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
