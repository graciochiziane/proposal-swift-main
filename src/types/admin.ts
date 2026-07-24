// ============================================================
// Admin types — Fase 4 SuperAdmin Panel
// ============================================================

export type PlanTier = 'free' | 'pro' | 'business';

export interface Tenant {
  id: string;
  nome: string;
  slug: string;
  logo_url: string;
  cor_primaria: string;
  plano: PlanTier;
  propostas_mes_count: number;
  geracoes_ia_mes_count: number;
  suspended_at: string | null;
  suspension_reason: string | null;
  monthly_price: number;
  notes: string;
  last_proposal_created_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantDetail extends Tenant {
  member_count: number;
  health_score: number;
}

export interface TenantMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  joined_at: string;
  invited_by: string | null;
  profiles?: { nome: string | null; email: string };
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  target_owner_id: string | null;
  target_snapshot: Record<string, unknown> | null;
  created_at: string;
  admin_email?: string;
}

export interface CreateTenantData {
  nome: string;
  email: string;
  plano: PlanTier;
}

export interface UpdateTenantData {
  nome?: string;
  plano?: PlanTier;
  monthly_price?: number;
  notes?: string;
}
