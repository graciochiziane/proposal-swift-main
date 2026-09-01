// ============================================================
// HTML Document Utilities — geração de propostas via HTML
//
// Único formato de geração de propostas da plataforma:
// o documento final é um HTML autónomo (standalone).
// Para PDF, o utilizador usa Imprimir > Guardar como PDF
// do browser (caminho nativo, sem libs externas).
//
// Responsibilities:
//   - wrapHtmlDocument: envolve um fragmento HTML num
//     documento completo (print-ready A4 + botão imprimir)
//   - downloadHtmlFile: download de .html via Blob
//   - openHtmlPreview: abre o HTML numa nova janela
// ============================================================

/** Estilos base injectados no documento final */
const BASE_STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #eef1f5; }
  .ps-page {
    background: #ffffff;
    max-width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  }
  .ps-print-btn {
    position: fixed; top: 1rem; right: 1rem;
    padding: 10px 22px;
    background: #1e293b; color: #ffffff;
    border: none; border-radius: 8px;
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    font-size: 14px; font-weight: 600;
    cursor: pointer; z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  .ps-print-btn:hover { background: #0f172a; }
  @page { size: A4; }
  @media print {
    html, body { background: #ffffff; }
    .ps-page { max-width: none; min-height: auto; box-shadow: none; margin: 0; }
    .ps-no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const PRINT_BUTTON_LABEL = 'Imprimir / Guardar PDF';

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * True se o conteúdo já é um documento HTML completo
 * (template autoral com <html>/<body> próprios).
 */
function isFullDocument(html: string): boolean {
  return /<!doctype\s+html/i.test(html) || /<html[\s>]/i.test(html);
}

/**
 * Envelope de segurança para o botão de impressão:
 * o onclick usa apenas APIs nativas, sem string interpolation
 * de conteúdo do utilizador.
 */
const PRINT_BUTTON = `<button type="button" class="ps-print-btn ps-no-print" onclick="window.print()">${PRINT_BUTTON_LABEL}</button>`;

/**
 * Envolve um fragmento HTML (com <style> próprio do template)
 * num documento completo, print-ready.
 *
 * Templates armazenados em pdf_templates são fragmentos
 * (sem <html>/<head>). Este wrapper adiciona:
 *   - <meta charset> e viewport
 *   - folha A4 no ecrã (visualização fiel à impressão)
 *   - regras @media print (cor exacta, ocultar botão)
 *   - botão "Imprimir / Guardar PDF" (não sai na impressão)
 *
 * Se o conteúdo já for um documento completo, é devolvido
 * tal qual (respeita o autor do template).
 */
export function wrapHtmlDocument(fragment: string, title: string): string {
  if (isFullDocument(fragment)) return fragment;

  return `<!DOCTYPE html>
<html lang="pt-MZ">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${PRINT_BUTTON}
  <div class="ps-page">
${fragment}
  </div>
</body>
</html>`;
}

/**
 * Sanitiza o nome do ficheiro: remove separadores de path,
 * espaços e caracteres de controlo; garante extensão .html.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = (name || 'proposta')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const withExt = cleaned.toLowerCase().endsWith('.html') ? cleaned : `${cleaned}.html`;
  return withExt || 'proposta.html';
}

/**
 * Descarrega um documento HTML como ficheiro .html
 * (Blob + <a download> — sem dependências externas).
 */
export function downloadHtmlFile(html: string, fileName: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFileName(fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revogar no próximo tick: o download já foi iniciado
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Abre o documento HTML numa nova janela do browser
 * (preview + botão Imprimir já embutido no documento).
 */
export function openHtmlPreview(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
