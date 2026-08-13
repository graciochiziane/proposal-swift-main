// ============================================================
// Advanced Proposals Service
// All DB operations for the Blueprint Engine
//
// P1-H7 (2026-08-13): createAdvancedProposal now verifies that the
//   caller is a member of the target organization before inserting.
//   Previously accepted caller-supplied organizationId without check.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  BusinessCategory,
  ProposalBlueprint,
  ProposalSection,
  SectionQuestion,
  CompanyBrandProfile,
  AdvancedProposal,
  ProposalSectionAnswer,
  BlueprintWithSections,
  AdvancedProposalWithAnswers,
} from '@/types/advancedProposal';

// --- Business Categories ---

export async function getBusinessCategories(): Promise<BusinessCategory[]> {
  const { data, error } = await supabase
    .from('business_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data as BusinessCategory[];
}

export async function getBusinessCategoryBySlug(slug: string): Promise<BusinessCategory | null> {
  const { data, error } = await supabase
    .from('business_categories')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as BusinessCategory | null;
}

// --- Blueprints ---

export async function getBlueprintsByCategory(categoryId: string): Promise<ProposalBlueprint[]> {
  const { data, error } = await supabase
    .from('proposal_blueprints')
    .select('*')
    .eq('business_category_id', categoryId)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data as ProposalBlueprint[];
}

export async function getBlueprintWithSections(blueprintId: string): Promise<BlueprintWithSections | null> {
  const { data: blueprint, error: bpError } = await supabase
    .from('proposal_blueprints')
    .select('*')
    .eq('id', blueprintId)
    .eq('active', true)
    .single();
  if (bpError) {
    if (bpError.code === 'PGRST116') return null;
    throw bpError;
  }

  const { data: category, error: catError } = await supabase
    .from('business_categories')
    .select('*')
    .eq('id', blueprint.business_category_id)
    .single();
  if (catError) throw catError;

  const { data: sections, error: secError } = await supabase
    .from('proposal_sections')
    .select('*')
    .eq('blueprint_id', blueprintId)
    .order('order', { ascending: true });
  if (secError) throw secError;

  const sectionIds = sections.map((s: ProposalSection) => s.id);
  const { data: questions, error: qError } = await supabase
    .from('section_questions')
    .select('*')
    .in('section_id', sectionIds)
    .order('order', { ascending: true });
  if (qError) throw qError;

  const questionsBySection: Record<string, SectionQuestion[]> = {};
  for (const section of sections) {
    questionsBySection[section.id] = (questions as SectionQuestion[])
      .filter((q: SectionQuestion) => q.section_id === section.id);
  }

  return {
    blueprint: blueprint as ProposalBlueprint,
    category: category as BusinessCategory,
    sections: sections as ProposalSection[],
    questions: questionsBySection,
  };
}

// --- Advanced Proposals ---

export async function createAdvancedProposal(input: {
  organizationId: string;
  clientId: string | null;
  blueprintId: string;
  blueprintVersion: number;
  title: string;
  totalSections: number;
}): Promise<AdvancedProposal> {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData.user) throw new Error('Não autenticado');

  // P1-H7: Verificar que o caller é membro da organização alvo
  // Impede criar propostas em nome de orgs alheias
  const { data: membership, error: mbErr } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', input.organizationId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (mbErr) throw new Error(`Erro ao verificar membership: ${mbErr.message}`);
  if (!membership) {
    throw new Error('Acesso negado: não é membro desta organização');
  }

  const { data, error } = await supabase
    .from('advanced_proposals')
    .insert({
      organization_id: input.organizationId,
      owner_id: userData.user.id,
      client_id: input.clientId,
      blueprint_id: input.blueprintId,
      blueprint_version: input.blueprintVersion,
      title: input.title,
      status: 'rascunho',
      current_section_index: 0,
      total_sections: input.totalSections,
    })
    .select()
    .single();
  if (error) throw error;
  return data as AdvancedProposal;
}

export async function getAdvancedProposal(id: string): Promise<AdvancedProposal | null> {
  const { data, error } = await supabase
    .from('advanced_proposals')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as AdvancedProposal | null;
}

export async function getAdvancedProposals(): Promise<AdvancedProposal[]> {
  const { data, error } = await supabase
    .from('advanced_proposals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AdvancedProposal[];
}

/** Get advanced proposals with their blueprint and category names */
export async function getAdvancedProposalsWithBlueprint(): Promise<Array<
  AdvancedProposal & { blueprint_name?: string; category_name?: string }
>> {
  // FIX: PostgREST nested join syntax — business_categories must be nested
  // inside proposal_blueprints, not chained with a dot.
  // Old (broken): proposal_blueprints(name, business_category_id), proposal_blueprints.business_categories(name)
  // New (correct): proposal_blueprints(name, business_category_id, business_categories(name))
  const { data, error } = await supabase
    .from('advanced_proposals')
    .select(`
      *,
      proposal_blueprints!blueprint_id(name, business_category_id, business_categories!business_category_id(name))
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    blueprint_name: row.proposal_blueprints?.name || '',
    category_name: row.proposal_blueprints?.business_categories?.name || '',
  }));
}

export async function deleteAdvancedProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from('advanced_proposals')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function updateAdvancedProposalStatus(
  id: string,
  status: AdvancedProposal['status'],
  currentSectionIndex?: number,
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (currentSectionIndex !== undefined) {
    updates.current_section_index = currentSectionIndex;
  }
  const { error } = await supabase
    .from('advanced_proposals')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// --- Section Answers ---

export async function saveSectionAnswers(
  advancedProposalId: string,
  sectionId: string,
  sectionTitle: string,
  sectionOrder: number,
  answers: Record<string, string>,
): Promise<ProposalSectionAnswer> {
  const { data, error } = await supabase
    .from('proposal_section_answers')
    .upsert(
      {
        advanced_proposal_id: advancedProposalId,
        section_id: sectionId,
        section_title: sectionTitle,
        section_order: sectionOrder,
        answers,
        content_status: 'pendente',
      },
      { onConflict: 'advanced_proposal_id,section_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as ProposalSectionAnswer;
}

export async function saveSectionAIContent(
  id: string,
  aiContent: string,
  aiModel: string,
  aiTokensUsed: number,
): Promise<void> {
  const { error } = await supabase
    .from('proposal_section_answers')
    .update({
      ai_content: aiContent,
      ai_model: aiModel,
      ai_tokens_used: aiTokensUsed,
      content_status: 'gerado',
      generated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function saveSectionEditedContent(
  id: string,
  editedContent: string,
): Promise<void> {
  const { error } = await supabase
    .from('proposal_section_answers')
    .update({
      edited_content: editedContent,
      content_status: 'editando',
      edited_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function getSectionAnswers(
  advancedProposalId: string,
): Promise<ProposalSectionAnswer[]> {
  const { data, error } = await supabase
    .from('proposal_section_answers')
    .select('*')
    .eq('advanced_proposal_id', advancedProposalId)
    .order('section_order', { ascending: true });
  if (error) throw error;
  return data as ProposalSectionAnswer[];
}

// --- Brand Profiles ---

export async function getBrandProfile(
  organizationId: string,
): Promise<CompanyBrandProfile | null> {
  const { data, error } = await supabase
    .from('company_brand_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as CompanyBrandProfile | null;
}

export async function saveBrandProfile(input: {
  organizationId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontPreference: string;
  visualStyle: CompanyBrandProfile['visual_style'];
}): Promise<CompanyBrandProfile> {
  const { data, error } = await supabase
    .from('company_brand_profiles')
    .upsert(
      {
        organization_id: input.organizationId,
        primary_color: input.primaryColor,
        secondary_color: input.secondaryColor,
        accent_color: input.accentColor,
        font_preference: input.fontPreference,
        visual_style: input.visualStyle,
      },
      { onConflict: 'organization_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as CompanyBrandProfile;
}