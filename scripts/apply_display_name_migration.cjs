const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ewlkdrwrespnxyddwtgo',
  password: 'OperaOmnia#89',
  ssl: { rejectUnauthorized: false },
});

const statements = [
  `ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT ''`,
  `ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT ''`,
  `DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles`,
  `CREATE POLICY "profiles_select_org" ON public.profiles FOR SELECT TO authenticated
    USING (
      id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = profiles.id
          AND om.organization_id = user_org_id(auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin')
    )`,
  `CREATE OR REPLACE FUNCTION public.accept_invitation(
    p_invitation_id uuid,
    p_user_id uuid,
    p_user_email text
  )
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  DECLARE
    v_invite RECORD;
  BEGIN
    SELECT i.id, i.organization_id, i.role, i.invited_by, i.email, i.nome
      INTO v_invite
      FROM public.organization_invitations i
      WHERE i.id = p_invitation_id
        AND i.email = p_user_email
        AND i.accepted_at IS NULL
        AND i.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Convite nao encontrado ou expirado';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = p_user_id
        AND organization_id = v_invite.organization_id
    ) THEN
      RAISE EXCEPTION 'Ja e membro desta organizacao';
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, display_name)
      VALUES (v_invite.organization_id, p_user_id, v_invite.role, v_invite.invited_by,
              COALESCE(NULLIF(v_invite.nome, ''), ''));

    UPDATE public.organization_invitations
      SET accepted_at = now()
      WHERE id = p_invitation_id;

    UPDATE public.profiles
      SET organization_id = v_invite.organization_id
      WHERE id = p_user_id
        AND organization_id IS NULL;
  END;
  $$;`,
];

async function run() {
  await client.connect();
  console.log('Connected to Supabase');

  for (let i = 0; i < statements.length; i++) {
    try {
      await client.query(statements[i]);
      console.log(`Statement ${i + 1} OK`);
    } catch (err) {
      console.error(`Statement ${i + 1} FAILED:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  console.log('All statements applied successfully');
  await client.end();
}

run();