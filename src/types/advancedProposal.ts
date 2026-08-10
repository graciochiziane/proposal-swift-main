// ============================================================
// Advanced Proposals — Type Definitions
// Matches DB schema from migration 20260807000000
// ============================================================

// --- Enums ---

export type VisualStyle = 'corporate' | 'premium' | 'minimal' | 'technical';

export type AdvancedProposalStatus =
  | 'rascunho'
  | 'em_preenchimento'
  | 'em_revisao'
  | 'concluida'
  | 'exportada';

export type ContentStatus =
  | 'pendente'
  | 'gerando'
  | 'gerado'
  | 'editando'
  | 'revisado'
  | 'erro';

export type QuestionType = 'text' | 'textarea' | 'number' | 'select';

// --- Content Rules (validated JSONB contract) ---

export interface ContentRules {
  minWords?: number;
  maxWords?: number;
  tone?: 'formal' | 'technical' | 'commercial' | 'persuasivo' | 'consultivo';
  requiresData?: boolean;
  allowsBullets?: boolean;
  allowsTable?: boolean;
  promptHint?: string;
}

// --- Visibility Rules for questions ---

export interface VisibilityRule {
  showIf?: {
    questionId: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
    value: string;
  };
}

// --- DB Entity Types ---

export interface BusinessCategory {
  id: string;
  name: string;
  description: string;
  slug: string;
  icon: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProposalBlueprint {
  id: string;
  name: string;
  description: string;
  business_category_id: string;
  version: number;
  is_default: boolean;
  active: boolean;
  estimated_pages: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalSection {
  id: string;
  blueprint_id: string;
  type: string;
  title: string;
  order: number;
  required: boolean;
  content_rules: ContentRules;
  created_at: string;
  updated_at: string;
}

export interface SectionQuestion {
  id: string;
  section_id: string;
  question_text: string;
  placeholder: string;
  order: number;
  required: boolean;
  question_type: QuestionType;
  visibility_rules: VisibilityRule;
  created_at: string;
  updated_at: string;
}

export interface CompanyBrandProfile {
  id: string;
  organization_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_preference: string;
  visual_style: VisualStyle;
  logo_colors_extracted: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AdvancedProposal {
  id: string;
  organization_id: string;
  owner_id: string;
  client_id: string | null;
  blueprint_id: string | null;
  blueprint_version: number;
  title: string;
  status: AdvancedProposalStatus;
  brand_profile_id: string | null;
  current_section_index: number;
  total_sections: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalSectionAnswer {
  id: string;
  advanced_proposal_id: string;
  section_id: string;
  section_title: string;
  section_order: number;
  answers: Record<string, string>;
  ai_content: string;
  ai_model: string;
  ai_tokens_used: number;
  edited_content: string;
  content_status: ContentStatus;
  error_message: string;
  generated_at: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Composite types for API responses ---

export interface BlueprintWithSections {
  blueprint: ProposalBlueprint;
  category: BusinessCategory;
  sections: ProposalSection[];
  questions: Record<string, SectionQuestion[]>; // sectionId -> questions
}

export interface AdvancedProposalWithAnswers {
  proposal: AdvancedProposal;
  client: { id: string; nome: string; empresa: string } | null;
  blueprint: BlueprintWithSections | null;
  answers: ProposalSectionAnswer[];
  brand_profile: CompanyBrandProfile | null;
}

// --- AI Generation Contract ---

export interface AIGenerationInput {
  sectionId: string;
  sectionTitle: string;
  sectionType: string;
  contentRules: ContentRules;
  questions: SectionQuestion[];
  answers: Record<string, string>;
  companyInfo: {
    name: string;
    description: string;
    contact: string;
  };
  clientInfo: {
    name: string;
    company: string;
  };
  previousSections: { title: string; content: string }[];
}

export interface AIGenerationOutput {
  sectionId: string;
  content: string;
  warnings: string[];
  missingInformation: string[];
}
