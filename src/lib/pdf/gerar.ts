// ============================================================
// Geração de Propostas em PDF — API pública
//
//   gerarPropostaPdf  → jsPDF (para casos especiais)
//   baixarPropostaPdf → download do ficheiro .pdf
//   previsualizarPdf  → abre o PDF numa nova janela (blob URL)
//   pdfPropostaBase64 → base64 para envio por email
//   resolverLogotipoParaPdf → converte o logotipo (URL assinada
//     do Storage) em data URL, único formato que o jsPDF embute
// ============================================================

import type { jsPDF } from 'jspdf';
import type { DadosPropostaPdf, PdfTemplateId } from './tipos';
import { desenharExecutivo } from './templateExecutivo';
import { desenharEditorial } from './templateEditorial';
import { desenharCotacao } from './templateCotacao';
import { desenharMinimal } from './templateMinimal';
import { nomeFicheiroPdf } from './utils';

/** Gera o documento PDF (vectorial) com o template indicado */
export function gerarPropostaPdf(dados: DadosPropostaPdf, templateId: PdfTemplateId): jsPDF {
  const motor = templateId === 'editorial'
    ? desenharEditorial(dados)
    : templateId === 'cotacao'
      ? desenharCotacao(dados)
      : templateId === 'minimal'
        ? desenharMinimal(dados)
        : desenharExecutivo(dados);
  return motor.doc;
}

/** Descarrega o PDF com nome normalizado "Proposta-<numero>.pdf" */
export function baixarPropostaPdf(dados: DadosPropostaPdf, templateId: PdfTemplateId): void {
  const doc = gerarPropostaPdf(dados, templateId);
  doc.save(nomeFicheiroPdf(`Proposta-${dados.numero}`));
}

/** Abre o PDF numa nova janela para pré-visualização */
export function previsualizarPdf(dados: DadosPropostaPdf, templateId: PdfTemplateId): void {
  const doc = gerarPropostaPdf(dados, templateId);
  const blob = doc.output('blob') as Blob;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Gera o PDF e devolve-o em base64 puro (sem prefixo data:)
 * — formato aceite pela edge function de envio por email.
 */
export function pdfPropostaBase64(dados: DadosPropostaPdf, templateId: PdfTemplateId): string {
  const doc = gerarPropostaPdf(dados, templateId);
  const dataUri = doc.output('datauristring') as string;
  return dataUri.split(',')[1] ?? '';
}

// ============================================================
// Logotipo — resolução da URL assinada para data URL
//
// O IssuerService devolve o logotipo da organização (ou do
// perfil legado) como signed URL HTTP do bucket 'logos'; o jsPDF
// (via medirLogotipo) apenas embute data URLs PNG/JPEG. Sem este
// passo, o logotipo era silenciosamente ignorado por todos os
// modelos — e o fallback textual também não disparava, deixando
// a zona de identidade do cabeçalho vazia.
// ============================================================

/** Dimensão máxima (px) ao rasterizar formatos não suportados (webp/gif) */
const LIMITE_RASTERIZACAO_PX = 1200;

/** Lê um Blob como data URL via FileReader. */
function lerComoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error ?? new Error('falha ao ler imagem'));
    leitor.readAsDataURL(blob);
  });
}

/** Detecta o formato real pelos magic bytes (blob.type pode faltar). */
function detectarFormato(bytes: Uint8Array): string {
  const ascii = (i: number, fim: number): string =>
    String.fromCharCode(...bytes.slice(i, fim));
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && ascii(0, 3) === 'GIF') return 'image/gif';
  return '';
}

/**
 * Carrega a imagem para desenho em canvas — createImageBitmap
 * (rápido) com fallback para <img> (Safari antigo).
 */
async function carregarParaCanvas(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch { /* fallback abaixo */ }
  }
  const urlBlob = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('imagem inválida'));
      img.src = urlBlob;
    });
    return img;
  } finally {
    // após o load a cópia descodificada permanece no elemento
    URL.revokeObjectURL(urlBlob);
  }
}

/** Rasteriza (webp/gif/…) em data URL PNG, limitando a dimensão. */
async function rasterizarParaPng(blob: Blob): Promise<string> {
  const fonte = await carregarParaCanvas(blob);
  try {
    const larguraFonte = 'width' in fonte ? fonte.width : 0;
    const alturaFonte = 'height' in fonte ? fonte.height : 0;
    const escala = Math.min(1, LIMITE_RASTERIZACAO_PX / Math.max(larguraFonte, alturaFonte, 1));
    const w = Math.max(1, Math.round(larguraFonte * escala));
    const h = Math.max(1, Math.round(alturaFonte * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d indisponível');
    ctx.drawImage(fonte, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png')) throw new Error('rasterização falhou');
    return dataUrl;
  } finally {
    if ('close' in fonte && typeof fonte.close === 'function') fonte.close();
  }
}

/**
 * Garante que `empresa.logotipo` está em formato embutível pelo jsPDF:
 *   - já é data URL → devolve os dados inalterados
 *   - URL http(s) PNG/JPEG → descarrega e converte em data URL
 *   - URL http(s) webp/gif → rasteriza em PNG (formato aceite)
 *   - falha (offline, formato desconhecido, SVG) → logotipo a
 *     undefined, para que os modelos caiam no fallback textual
 * Devolve sempre uma cópia; nunca lança.
 */
export async function resolverLogotipoParaPdf(dados: DadosPropostaPdf): Promise<DadosPropostaPdf> {
  const url = dados.empresa.logotipo;
  if (!url || url.startsWith('data:')) return dados;

  const semLogotipo = (): DadosPropostaPdf => ({
    ...dados,
    empresa: { ...dados.empresa, logotipo: undefined },
  });

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return semLogotipo();
    const blob = await resposta.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const formato = blob.type && blob.type !== 'image/svg+xml' && blob.type.startsWith('image/')
      ? blob.type
      : detectarFormato(bytes);

    if (formato === 'image/png' || formato === 'image/jpeg' || formato === 'image/jpg') {
      const dataUrl = await lerComoDataUrl(blob);
      return { ...dados, empresa: { ...dados.empresa, logotipo: dataUrl } };
    }
    if (formato) {
      const png = await rasterizarParaPng(new Blob([bytes], { type: formato }));
      return { ...dados, empresa: { ...dados.empresa, logotipo: png } };
    }
    return semLogotipo();
  } catch {
    // signed URL expirada, rede, decode — degrada para o fallback
    return semLogotipo();
  }
}
