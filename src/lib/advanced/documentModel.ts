// ============================================================
// Proposal Document Model
// Abstracao que transforma Blueprint + Answers + AI Content
// num documento estruturado pronto para renderizacao
//
// P0-C5 (2026-08-13): Added escapeHtml to prevent stored XSS
//   AI-generated content may contain markdown that, when converted
//   to HTML, could include <script> tags or onerror handlers.
//   All text is now HTML-escaped BEFORE markdown processing.
// ============================================================

import type {
  BlueprintWithSections,
  ProposalSectionAnswer,
  CompanyBrandProfile,
  ContentRules,
} from '@/types/advancedProposal';

export type DocSectionType =
  | 'cover'
  | 'text'
  | 'methodology'
  | 'timeline'
  | 'pricing'
  | 'terms'
  | 'custom';

export interface DocSection {
  id: string;
  type: DocSectionType;
  title: string;
  order: number;
  required: boolean;
  content: string;
  rawContent: string;
  contentRules: ContentRules;
  warnings: string[];
  missingInformation: string[];
  hasEdits: boolean;
  wordCount: number;
}

export interface DocMetadata {
  proposalId: string;
  title: string;
  category: string;
  blueprintName: string;
  companyName: string;
  companyContact: string;
  companyNuit: string;
  companyAddress: string;
  companyLogo?: string;
  clientName: string;
  clientCompany: string;
  clientEmail?: string;
  clientPhone?: string;
  generatedAt: string;
  totalSections: number;
  completedSections: number;
}

export interface DocBrand {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontPreference: string;
  visualStyle: string;
}

export interface ProposalDocument {
  metadata: DocMetadata;
  brand: DocBrand;
  sections: DocSection[];
  totalWords: number;
  isComplete: boolean;
}

export interface TransformInput {
  proposalId: string;
  proposalTitle: string;
  blueprint: BlueprintWithSections;
  answers: ProposalSectionAnswer[];
  brandProfile: CompanyBrandProfile | null;
  companyInfo: {
    name: string;
    description: string;
    contact: string;
    nuit: string;
    address: string;
    logo?: string;
  };
  clientInfo: {
    name: string;
    company: string;
    email?: string;
    phone?: string;
  };
}

export function buildProposalDocument(input: TransformInput): ProposalDocument {
  const sections: DocSection[] = [];
  let totalWords = 0;
  let completedSections = 0;

  for (const sectionDef of input.blueprint.sections) {
    const answer = input.answers.find(a => a.section_id === sectionDef.id);

    const editedContent = answer?.edited_content || '';
    const aiContent = answer?.ai_content || '';
    const finalContent = editedContent || aiContent;
    const wordCount = countWords(finalContent);
    totalWords += wordCount;

    const isGenerated =
      answer?.content_status === 'gerado' ||
      answer?.content_status === 'editando' ||
      answer?.content_status === 'revisado';
    if (isGenerated) completedSections++;

    sections.push({
      id: sectionDef.id,
      type: (sectionDef.type as DocSectionType) || 'text',
      title: sectionDef.title,
      order: sectionDef.order,
      required: sectionDef.required,
      content: finalContent,
      rawContent: aiContent,
      contentRules: sectionDef.content_rules || {},
      warnings: [],
      missingInformation: [],
      hasEdits: !!editedContent && editedContent !== aiContent,
      wordCount,
    });
  }

  const brand: DocBrand = input.brandProfile
    ? {
        primaryColor: input.brandProfile.primary_color,
        secondaryColor: input.brandProfile.secondary_color,
        accentColor: input.brandProfile.accent_color,
        fontPreference: input.brandProfile.font_preference,
        visualStyle: input.brandProfile.visual_style,
      }
    : {
        primaryColor: '#1e40af',
        secondaryColor: '#f8fafc',
        accentColor: '#3b82f6',
        fontPreference: 'inter',
        visualStyle: 'corporate',
      };

  return {
    metadata: {
      proposalId: input.proposalId,
      title: input.proposalTitle,
      category: input.blueprint.category.name,
      blueprintName: input.blueprint.blueprint.name,
      companyName: input.companyInfo.name,
      companyContact: input.companyInfo.contact,
      companyNuit: input.companyInfo.nuit,
      companyAddress: input.companyInfo.address,
      companyLogo: input.companyInfo.logo,
      clientName: input.clientInfo.name,
      clientCompany: input.clientInfo.company,
      clientEmail: input.clientInfo.email,
      clientPhone: input.clientInfo.phone,
      generatedAt: new Date().toISOString(),
      totalSections: sections.length,
      completedSections,
    },
    brand,
    sections,
    totalWords,
    isComplete: completedSections === sections.length,
  };
}

function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

// --- Markdown to HTML ---

/**
 * Escapes HTML special characters to prevent XSS.
 * Applied to all AI-generated content before markdown processing.
 * Markdown syntax characters (* _ ` [ ] # - |) are NOT escaped,
 * only HTML-breaking characters (& < > ").
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function markdownToHtml(md: string): string {
  if (!md) return '';
  // P0-C5: Escape HTML before markdown processing to prevent XSS.
  // Markdown syntax chars are preserved; only HTML special chars are escaped.
  // This means <script>alert(1)</script> in AI output becomes
  // &lt;script&gt;alert(1)&lt;/script&gt; which renders as text, not as HTML.
  const html = convertTables(escapeHtml(md));
  const lines = html.split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inUl && !trimmed.startsWith('- ') && !trimmed.startsWith('* ')) {
      result.push('</ul>'); inUl = false;
    }
    if (inOl && !/^[0-9]+\.\s/.test(trimmed)) {
      result.push('</ol>'); inOl = false;
    }
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      result.push(`<h3>${processInline(trimmed.slice(3))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      result.push(`<h2>${processInline(trimmed.slice(2))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inUl) { result.push('<ul>'); inUl = true; }
      result.push(`<li>${processInline(trimmed.slice(2))}</li>`);
      continue;
    }
    const olMatch = trimmed.match(/^[0-9]+\.\s(.+)/);
    if (olMatch) {
      if (!inOl) { result.push('<ol>'); inOl = true; }
      result.push(`<li>${processInline(olMatch[1])}</li>`);
      continue;
    }
    result.push(`<p>${processInline(trimmed)}</p>`);
  }
  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');
  return result.join('\n');
}

function processInline(text: string): string {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*(?!=)(.+?)(?<!\*)\*(?!=)/g, '<em>$1</em>');
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  text = text.replace(/\[INFORMACAO EM FALTA\]/g,
    '<span class="missing-info">[INFORMACAO EM FALTA]</span>');
  return text;
}

function convertTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let headerDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (/^\|[-\s|:]+$/.test(trimmed)) { headerDone = true; continue; }
      if (!inTable) { result.push('<table>'); inTable = true; headerDone = false; }
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      if (!headerDone) {
        result.push('<thead><tr>' + cells.map(c => `<th>${processInline(c)}</th>`).join('') + '</tr></thead><tbody>');
      } else {
        result.push('<tr>' + cells.map(c => `<td>${processInline(c)}</td>`).join('') + '</tr>');
      }
    } else {
      if (inTable) { result.push('</tbody></table>'); inTable = false; }
      result.push(line);
    }
  }
  if (inTable) result.push('</tbody></table>');
  return result.join('\n');
}
