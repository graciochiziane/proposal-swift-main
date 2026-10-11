-- =============================================
-- Ponto B: Storage RLS org-aware para bucket 'logos'
-- 
-- Antes: policies filtravam por foldername(name)[1] = auth.uid()
--   → Só o owner que fez upload conseguia ler. Outros membros da org não.
--   → Não distinguia entre orgs (qualquer user via-se o que quisesse se fosse o owner do path).
--
-- Depois: 
--   SELECT: qualquer membro da org pode ler logos org-based,
--           user pode ler o seu próprio path legacy,
--           platform admin vê tudo.
--   INSERT/UPDATE/DELETE: admin+ da org ou próprio user (legacy),
--                         platform admin pode tudo.
--
-- Path convention:
--   Legacy (profiles.logotipo_url):  {user_id}/{filename}
--   Org     (organizations.logo_url): {organization_id}/{filename}
-- =============================================

-- 1. Drop old policies
DROP POLICY IF EXISTS logos_admin_delete ON storage.objects;
DROP POLICY IF EXISTS logos_admin_select ON storage.objects;
DROP POLICY IF EXISTS logos_delete_own ON storage.objects;
DROP POLICY IF EXISTS logos_insert_own ON storage.objects;
DROP POLICY IF EXISTS logos_select_own ON storage.objects;
DROP POLICY IF EXISTS logos_update_own ON storage.objects;

-- 2. SELECT — qualquer membro da org lê, dono do path lê, admin vê tudo
CREATE POLICY logos_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (
      -- Org path: folder = organization_id → qualquer membro pode ler
      user_belongs_to_org((storage.foldername(name))[1]::uuid)
      -- Legacy path: folder = próprio user_id
      OR (storage.foldername(name))[1] = auth.uid()::text
      -- Platform admin
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 3. INSERT — admin+ da org OU próprio user (legacy)
CREATE POLICY logos_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (
      -- Org path: admin+ da org pode fazer upload do logo
      (user_belongs_to_org((storage.foldername(name))[1]::uuid)
       AND has_org_role_min_in_org((storage.foldername(name))[1]::uuid, 'admin'::org_role))
      -- Legacy path: próprio user
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- 4. UPDATE — admin+ da org OU próprio user (legacy)
CREATE POLICY logos_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (
      (user_belongs_to_org((storage.foldername(name))[1]::uuid)
       AND has_org_role_min_in_org((storage.foldername(name))[1]::uuid, 'admin'::org_role))
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 5. DELETE — admin+ da org OU próprio user (legacy) OU platform admin
CREATE POLICY logos_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (
      (user_belongs_to_org((storage.foldername(name))[1]::uuid)
       AND has_org_role_min_in_org((storage.foldername(name))[1]::uuid, 'admin'::org_role))
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );