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
    // Buscar nome da org
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

    await fetch(functionUrl, {
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
  },

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

    // Disparar email de convite via Edge Function (fire-and-forget)
    // Se a Edge Function nao estiver deployada ou RESEND_API_KEY nao existir,
    // o convite continua funcional via banner in-app.
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

    // Buscar convites (sem join — FK invited_by -> auth.users)
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

    // Buscar profiles dos inviters separadamente
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
   * Busca um convite pelo token (usado na rota /invite/accept).
   * Disponivel para utilizadores nao autenticados (RLS oi_select_by_token).
   */
  async getByToken(token: string): Promise<Invitation | null> {
    // Usa RPC SECURITY DEFINER — nao depende de RLS, funciona para anon
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
   */
  async acceptByToken(token: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nao autenticado');

    // Buscar convite por token (via RPC — funciona independentemente de RLS)
    const invite = await this.getByToken(token);

    if (!invite) {
      throw new Error('Convite nao encontrado ou expirado');
    }

    // Verificar email
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
      .eq('id', invite.id);

    if (acceptError) throw acceptError;

    // Actualizar profile com organization_id
    await supabase
      .from('profiles')
      .update({ organization_id: invite.organization_id })
      .eq('id', user.id);
  },

  /**
   * Lista convites pendentes dirigidos ao utilizador actual.
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

    // O join organizations(nome) FUNCIONA porque FK aponta para organizations(id)
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*, organizations(nome)')
      .eq('email', profile.email.toLowerCase())
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) return [];
    return ((data || []) as any[]).map((d: any) => ({ ...d, inviterNome: null }));
  },
};