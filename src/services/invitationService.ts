import { supabase } from '@/integrations/supabase/client';
import type { OrgRole } from '@/hooks/useOrganization';

// ── Types ──
export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  inviterNome: string | null;
  orgNome?: string | null;
}

// ── Internal helper: core accept logic via RPC (atomic, no race conditions) ──
async function _acceptViaRpc(invitationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nao autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  const userEmail = profile?.email?.toLowerCase();
  if (!userEmail) throw new Error('Perfil sem email');

  const { error } = await supabase.rpc('accept_invitation', {
    p_invitation_id: invitationId,
    p_user_id: user.id,
    p_user_email: userEmail,
  });

  if (error) throw new Error(error.message || 'Erro ao aceitar convite');
}

// ── Service ──
export const InvitationService = {

  /**
   * Envia email de convite via Edge Function (fire-and-forget).
   * Privado — chamado internamente por create() e resend().
   */
  async _sendInviteEmail(
    invitationId: string,
    token: string,
    email: string,
    role: string,
    organizationId: string
  ): Promise<void> {
    const { data: org } = await supabase
      .from('organizations')
      .select('nome')
      .eq('id', organizationId)
      .single();

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = supabaseUrl
      ? `${supabaseUrl}/functions/v1/send-invite-email`
      : null;

    if (!functionUrl) return;

    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token;

    try {
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          invitation_id: invitationId,
          organization_id: organizationId,
          email,
          role,
          org_nome: org?.nome || 'Organização',
          token,
        }),
      });
      if (!res.ok) {
        console.warn('Edge function retornou erro:', res.status, await res.text().catch(() => ''));
      }
    } catch (err) {
      console.warn('Falha ao chamar Edge Function send-invite-email:', err);
    }
  },

  /**
   * Cria um convite para um email.
   * Requer owner ou admin na organizacao.
   */
  async create(email: string, role: OrgRole): Promise<Invitation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership?.organization_id) {
      throw new Error('Nao tem organizacao');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verificar se o email ja e utilizador e membro desta org
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', membership.organization_id)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error('Este utilizador ja e membro da organizacao.');
      }
    }

    // Verificar se ha convite pendente para este email
    const { data: pendingInvite } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('email', normalizedEmail)
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
        email: normalizedEmail,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Falha ao criar convite');

    this._sendInviteEmail(data.id, data.token, normalizedEmail, role, membership.organization_id).catch(
      (emailErr) => console.warn('Convite criado mas email nao enviado:', emailErr)
    );

    return { ...data, inviterNome: null } as unknown as Invitation;
  },

  /**
   * Lista convites pendentes da organizacao do utilizador.
   * Requer owner ou admin.
   */
  async getPendingInvitations(): Promise<Invitation[]> {
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
      .select('*')
      .eq('organization_id', membership.organization_id)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const inviterIds = [...new Set((data as any[]).map((i: any) => i.invited_by).filter(Boolean))] as string[];
    let profileMap = new Map<string, string | null>();

    if (inviterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', inviterIds);

      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, p.nome);
      });
    }

    return (data as any[]).map((inv: any) => ({
      ...inv,
      inviterNome: profileMap.get(inv.invited_by) ?? null,
    }));
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
   * Aceita um convite por ID (usado pelo InvitationBanner).
   * Delega tudo ao RPC atomico accept_invitation.
   */
  async accept(invitationId: string): Promise<void> {
    await _acceptViaRpc(invitationId);
  },

  /**
   * Busca um convite pelo token (usado na rota /invite/accept).
   * Usa RPC SECURITY DEFINER — funciona para anon.
   */
  async getByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .rpc('get_invitation_by_token', { p_token: token });

    if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
    const row = (Array.isArray(data) ? data[0] : data) as any;
    return {
      id: row.id,
      organization_id: row.organization_id,
      email: row.email,
      role: row.role,
      token: row.token,
      invited_by: row.invited_by,
      accepted_at: row.accepted_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
      inviterNome: null,
      orgNome: row.org_nome || null,
    };
  },

  /**
   * Aceita um convite pelo token (usado na rota /invite/accept).
   * O utilizador deve estar autenticado.
   * Reusa o mesmo RPC atomico — sem duplicacao de logica.
   */
  async acceptByToken(token: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    // Buscar convite por token para obter o ID
    const invite = await this.getByToken(token);
    if (!invite) {
      throw new Error('Convite nao encontrado ou expirado');
    }

    // Delegar ao RPC atomico (que tambem verifica email)
    await _acceptViaRpc(invite.id);
  },

  /**
   * Lista convites pendentes dirigidos ao utilizador actual.
   * Usa RPC SECURITY DEFINER — funciona para utilizadores nao-membros.
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
      .rpc('get_my_pending_invitations', {
        p_email: profile.email.toLowerCase(),
      });

    if (error) {
      console.error('Erro getMyPendingInvitations RPC:', error);
      return [];
    }

    return ((data || []) as any[]).map((d: any) => ({
      ...d,
      inviterNome: null,
      orgNome: d.org_nome || null,
    }));
  },

  /**
   * Reenvia um convite — renova expires_at por 7 dias.
   */
  async resend(invitationId: string): Promise<void> {
    const { data: invite, error: fetchErr } = await supabase
      .from('organization_invitations')
      .select('id, token, email, role, organization_id')
      .eq('id', invitationId)
      .is('accepted_at', null)
      .single();

    if (fetchErr || !invite) throw new Error('Convite nao encontrado');

    const { error: updateErr } = await supabase
      .from('organization_invitations')
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', invitationId);

    if (updateErr) throw updateErr;

    this._sendInviteEmail(
      invite.id,
      (invite as any).token,
      invite.email,
      invite.role,
      invite.organization_id
    ).catch((emailErr) => console.warn('Convite renovado mas email nao reenviado:', emailErr));
  },
};