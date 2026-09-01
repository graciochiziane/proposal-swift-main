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
