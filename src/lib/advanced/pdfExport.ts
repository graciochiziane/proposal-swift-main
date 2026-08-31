// ============================================================
// Advanced Proposal PDF Export
// Converte o HTML renderizado (advancedPdfRenderer) num PDF
// nativo usando html2canvas + jsPDF com paginacao A4
// ============================================================

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { renderProposalHtml } from './advancedPdfRenderer';
import type { ProposalDocument } from './documentModel';

// A4 dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// A4 width in pixels at 96 DPI (used for container sizing)
const A4_WIDTH_PX = 794;

// Render scale for high quality (2x = retina quality)
const RENDER_SCALE = 2;

// JPEG quality for page images (0.85 = good balance quality/size)
const JPEG_QUALITY = 0.92;

/**
 * Exports a ProposalDocument as a PDF file, triggering browser download.
 * The PDF preserves the exact visual appearance of the HTML renderer
 * (colors, typography, gradients, tables) at high resolution.
 */
export async function exportProposalPdf(doc: ProposalDocument): Promise<void> {
  // 1. Generate the full HTML document
  const html = renderProposalHtml(doc);

  // 2. Create an off-screen container that simulates A4 width
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${A4_WIDTH_PX}px;
    background: white;
    z-index: -1;
    opacity: 1;
  `;
  container.innerHTML = html;

  // Remove the print button (no-print class)
  const printBtn = container.querySelector('.print-btn');
  if (printBtn) printBtn.remove();

  // Remove any no-print elements
  container.querySelectorAll('.no-print').forEach(el => el.remove());

  document.body.appendChild(container);

  try {
    // 3. Wait for all images (logos) to load
    await waitForImages(container);

    // Extra delay for fonts and layout settling
    await delay(300);

    // 4. Capture the entire rendered document with html2canvas
    const fullCanvas = await html2canvas(container, {
      scale: RENDER_SCALE,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
      backgroundColor: '#ffffff',
    });

    // 5. Calculate page dimensions in canvas pixels
    // A4 ratio: height = width * (297/210)
    const pageHeightPx = Math.round(
      (fullCanvas.width / A4_WIDTH_MM) * A4_HEIGHT_MM
    );

    // 6. Split canvas into A4 pages and build PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const totalPages = Math.ceil(fullCanvas.height / pageHeightPx);

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      const sourceY = i * pageHeightPx;
      const sourceH = Math.min(pageHeightPx, fullCanvas.height - sourceY);

      // Crop a single page from the full canvas
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = fullCanvas.width;
      pageCanvas.height = sourceH;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas 2D context');

      // White background for this page slice
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      ctx.drawImage(
        fullCanvas,
        0, sourceY, fullCanvas.width, sourceH,
        0, 0, fullCanvas.width, sourceH,
      );

      // Calculate the mm dimensions of this page slice
      const sliceHeightMm = (sourceH / fullCanvas.width) * A4_WIDTH_MM;

      const imgData = pageCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, sliceHeightMm);
    }

    // 7. Set PDF metadata
    const safeTitle = doc.metadata.title
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\s\-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80);

    pdf.setProperties({
      title: doc.metadata.title,
      author: doc.metadata.companyName,
      subject: `Proposta: ${doc.metadata.title}`,
      creator: 'PropostaJa',
    });

    // 8. Trigger download
    pdf.save(`${safeTitle}.pdf`);
  } finally {
    // Always clean up the container
    document.body.removeChild(container);
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Waits for all <img> elements inside a container to finish loading.
 * Images that are already complete or fail to load are resolved immediately.
 */
function waitForImages(container: HTMLElement): Promise<void> {
  const images = container.querySelectorAll('img');
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    Array.from(images).map(
      img =>
        new Promise<void>(resolve => {
          if (img.complete) {
            resolve();
            return;
          }
          const onDone = () => {
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            resolve();
          };
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
          // Timeout after 5s to avoid blocking forever on broken images
          setTimeout(resolve, 5000);
        }),
    ),
  ).then(() => {});
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
