import { supabase } from '@/integrations/supabase/client';
import type { OrgRole } from '@/hooks/useOrganization';

// ── Types ──
export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface InvitationWithInviter extends Invitation {
  inviter_profile: { nome: string | null; email: string } | null;
}

// ── Service ──
export const InvitationService = {

  /**
   * Cria um convite para um email.
   * Requer owner ou admin na organizacao.
   */
  async create(email: string, role: OrgRole): Promise<Invitation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    // Buscar org_id
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership?.organization_id) {
      throw new Error('Nao tem organizacao');
    }

    // Verificar se email ja e membro
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    // Verificar se ha convite pendente para este email
    const { data: pendingInvite } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('email', email)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      throw new Error('Ja existe um convite pendente para este email.');
    }

    const { data, error } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: membership.organization_id,
        email: email.toLowerCase().trim(),
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Falha ao criar convite');

    return data as unknown as Invitation;
  },

  /**
   * Lista convites pendentes da organizacao do utilizador.
   * Requer owner ou admin.
   */
  async getPendingInvitations(): Promise<InvitationWithInviter[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership?.organization_id) return [];

    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*, inviter_profile:invited_by (nome, email)')
      .eq('organization_id', membership.organization_id)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites:', error);
      return [];
    }

    return (data || []) as unknown as InvitationWithInviter[];
  },

  /**
   * Cancela um convite pendente.
   */
  async cancel(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) throw error;
  },

  /**
   * Aceita um convite (por ID do convite).
   * Cria o membership e marca o convite como aceite.
   */
  async accept(invitationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    // Buscar convite
    const { data: invite, error: inviteError } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('id', invitationId)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      throw new Error('Convite nao encontrado ou expirado');
    }

    // Verificar se o email do convite bate com o user
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (profile?.email?.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error('Este convite nao e para o seu email.');
    }

    // Verificar se ja e membro
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', invite.organization_id)
      .maybeSingle();

    if (existingMember) {
      throw new Error('Ja e membro desta organizacao.');
    }

    // Criar membership
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
        invited_by: invite.invited_by,
      });

    if (memberError) throw memberError;

    // Marcar convite como aceite
    const { error: acceptError } = await supabase
      .from('organization_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitationId);

    if (acceptError) throw acceptError;

    // Actualizar profile com organization_id
    await supabase
      .from('profiles')
      .update({ organization_id: invite.organization_id })
      .eq('id', user.id);
  },

  /**
   * Lista convites pendentes dirigidos ao utilizador actual.
   * Usado para mostrar "Tem convites pendentes" no header.
   */
  async getMyPendingInvitations(): Promise<Invitation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!profile?.email) return [];

    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*, organizations(nome)')
      .eq('email', profile.email.toLowerCase())
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as unknown as Invitation[];
  },
};