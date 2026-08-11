-- ============================================================
-- AUDIT: Blueprint Engine Migration
-- Run this AFTER the migration to validate everything.
-- ============================================================

DO $$
DECLARE
  _pass INT := 0;
  _fail INT := 0;
  _msg  TEXT;

  -- helpers
  _cnt  INT;
  _exists BOOLEAN;

  -- function to check and report
  PROCEDURE check(test_name TEXT, condition BOOLEAN)
  IS BEGIN
    IF condition THEN
      _pass := _pass + 1;
      RAISE NOTICE '[PASS] %', test_name;
    ELSE
      _fail := _fail + 1;
      RAISE NOTICE '[FAIL] %', test_name;
    END IF;
  END;

BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '  AUDIT: Blueprint Engine Migration';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';

  -- ============================================================
  -- 1. ENUMS
  -- ============================================================
  RAISE NOTICE '--- 1. ENUMS ---';

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visual_style') INTO _exists;
  check('Enum public.visual_style existe', _exists);

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') INTO _exists;
  check('Enum public.org_role existe', _exists);

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') INTO _exists;
  check('Enum public.app_role existe', _exists);

  -- ============================================================
  -- 2. HELPER FUNCTIONS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 2. HELPER FUNCTIONS ---';

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) INTO _exists;
  check('Funcao has_role(uuid, text) existe', _exists);

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'user_role_in_org'
  ) INTO _exists;
  check('Funcao user_role_in_org(uuid) existe', _exists);

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'user_belongs_to_org'
  ) INTO _exists;
  check('Funcao user_belongs_to_org(uuid) existe', _exists);

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'has_org_role_min_in_org'
  ) INTO _exists;
  check('Funcao has_org_role_min_in_org(uuid, org_role) existe', _exists);

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) INTO _exists;
  check('Funcao set_updated_at() existe', _exists);

  -- Check SECURITY DEFINER + search_path on helper functions
  SELECT COUNT(*) INTO _cnt FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('has_role','user_role_in_org','user_belongs_to_org','has_org_role_min_in_org','set_updated_at')
    AND p.prosecdef = true;
  check('Todas as 5 funcoes sao SECURITY DEFINER', _cnt = 5);

  -- ============================================================
  -- 3. TABELAS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 3. TABELAS ---';

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='business_categories') INTO _exists;
  check('Tabela business_categories existe', _exists);

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='proposal_blueprints') INTO _exists;
  check('Tabela proposal_blueprints existe', _exists);

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='proposal_sections') INTO _exists;
  check('Tabela proposal_sections existe', _exists);

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='section_questions') INTO _exists;
  check('Tabela section_questions existe', _exists);

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company_brand_profiles') INTO _exists;
  check('Tabela company_brand_profiles existe', _exists);

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='advanced_proposals') INTO _exists;
  check('Tabela advanced_proposals existe', _exists);

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='proposal_section_answers') INTO _exists;
  check('Tabela proposal_section_answers existe', _exists);

  -- ============================================================
  -- 4. COLUNAS CRITICAS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 4. COLUNAS CRITICAS ---';

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='business_categories' AND column_name IN ('id','name','slug','icon','sort_order','active');
  check('business_categories tem 6 colunas essenciais', _cnt = 6);

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='proposal_blueprints' AND column_name IN ('id','name','business_category_id','version','is_default','active');
  check('proposal_blueprints tem 6 colunas essenciais', _cnt = 6);

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='proposal_sections' AND column_name IN ('id','blueprint_id','type','title','content_rules');
  check('proposal_sections tem 5 colunas essenciais', _cnt = 5);

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='section_questions' AND column_name IN ('id','section_id','question_text','placeholder','question_type');
  check('section_questions tem 5 colunas essenciais (placeholder, nao help_text)', _cnt = 5);

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='company_brand_profiles' AND column_name IN ('id','organization_id','primary_color','visual_style');
  check('company_brand_profiles tem organization_id + visual_style', _cnt = 4);

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='advanced_proposals' AND column_name IN ('id','organization_id','owner_id','client_id','blueprint_id','status','brand_profile_id');
  check('advanced_proposals tem 7 colunas essenciais', _cnt = 7);

  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='proposal_section_answers' AND column_name IN ('id','advanced_proposal_id','section_id','answers','ai_content','content_status');
  check('proposal_section_answers tem 6 colunas essenciais', _cnt = 6);

  -- proposals.blueprint_id (ALTER TABLE)
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='proposals' AND column_name='blueprint_id';
  check('proposals.blueprint_id adicionado via ALTER TABLE', _cnt = 1);

  -- ============================================================
  -- 5. FOREIGN KEYS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 5. FOREIGN KEYS ---';

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'proposal_blueprints'
    AND constraint_name LIKE '%business_categories%';
  check('FK: proposal_blueprints → business_categories', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'proposal_sections'
    AND constraint_name LIKE '%proposal_blueprints%';
  check('FK: proposal_sections → proposal_blueprints', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'section_questions'
    AND constraint_name LIKE '%proposal_sections%';
  check('FK: section_questions → proposal_sections', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'company_brand_profiles'
    AND constraint_name LIKE '%organizations%';
  check('FK: company_brand_profiles → organizations', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'advanced_proposals'
    AND constraint_name LIKE '%organizations%';
  check('FK: advanced_proposals → organizations', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'advanced_proposals'
    AND constraint_name LIKE '%auth%users%';
  check('FK: advanced_proposals → auth.users (owner_id)', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'proposal_section_answers'
    AND constraint_name LIKE '%advanced_proposals%';
  check('FK: proposal_section_answers → advanced_proposals', _cnt >= 1);

  -- ============================================================
  -- 6. CHECK CONSTRAINTS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 6. CHECK CONSTRAINTS ---';

  SELECT COUNT(*) INTO _cnt FROM pg_constraint
  JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
  JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
  WHERE pg_namespace.nspname = 'public'
    AND pg_class.relname = 'advanced_proposals'
    AND pg_constraint.contype = 'c';
  check('advanced_proposals tem CHECK constraint (status)', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM pg_constraint
  JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
  JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
  WHERE pg_namespace.nspname = 'public'
    AND pg_class.relname = 'proposal_section_answers'
    AND pg_constraint.contype = 'c';
  check('proposal_section_answers tem CHECK constraint (content_status)', _cnt >= 1);

  -- ============================================================
  -- 7. INDEXES
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 7. INDEXES ---';

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_business_categories%';
  check('Indice idx_business_categories_active', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_blueprints%';
  check('Indice idx_blueprints_category', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_proposal_sections%';
  check('Indice idx_proposal_sections_blueprint', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_section_questions%';
  check('Indice idx_section_questions_section', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_brand_profiles%';
  check('Indice idx_brand_profiles_org', _cnt >= 1);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_advanced_proposals%';
  check('Indices idx_advanced_proposals (org + owner)', _cnt = 2);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_section_answers%';
  check('Indices idx_section_answers (proposal + status)', _cnt = 2);

  SELECT COUNT(*) INTO _cnt FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'idx_proposals_blueprint_id';
  check('Indice idx_proposals_blueprint_id (partial)', _cnt = 1);

  -- ============================================================
  -- 8. TRIGGERS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 8. TRIGGERS ---';

  SELECT COUNT(*) INTO _cnt FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers')
    AND t.tgname LIKE 'trg_%_updated_at'
    AND NOT t.tgisinternal;
  check('7 triggers set_updated_at criados', _cnt = 7);

  -- ============================================================
  -- 9. RLS + POLICIES
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 9. RLS + POLICIES ---';

  -- RLS enabled
  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers')
    AND c.relrowsecurity = true;
  check('RLS habilitado nas 7 tabelas', _cnt > 0);

  -- All tables have RLS
  SELECT COUNT(DISTINCT c.relname) INTO _cnt
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers')
    AND c.relrowsecurity = true;
  check('Todas as 7 tabelas tem RLS enabled', _cnt = 7);

  -- Policy counts per table
  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'business_categories';
  check('business_categories: 2 policies (select + admin)', _cnt = 2);

  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'proposal_blueprints';
  check('proposal_blueprints: 2 policies', _cnt = 2);

  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'proposal_sections';
  check('proposal_sections: 2 policies', _cnt = 2);

  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'section_questions';
  check('section_questions: 2 policies', _cnt = 2);

  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'company_brand_profiles';
  check('company_brand_profiles: 4 policies (select/insert/update/delete)', _cnt = 4);

  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'advanced_proposals';
  check('advanced_proposals: 4 policies', _cnt = 4);

  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'proposal_section_answers';
  check('proposal_section_answers: 4 policies', _cnt = 4);

  -- Total policies
  SELECT COUNT(*) INTO _cnt FROM pg_policies p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers');
  check('Total: 20 policies criadas', _cnt = 20);

  -- ============================================================
  -- 10. SEED DATA
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 10. SEED DATA ---';

  SELECT COUNT(*) INTO _cnt FROM public.business_categories;
  check('business_categories: 3 rows (seed)', _cnt = 3);

  SELECT COUNT(*) INTO _cnt FROM public.proposal_blueprints;
  check('proposal_blueprints: 3 rows (seed)', _cnt = 3);

  SELECT COUNT(*) INTO _cnt FROM public.proposal_sections;
  check('proposal_sections: 15 rows (seed)', _cnt = 15);

  SELECT COUNT(*) INTO _cnt FROM public.section_questions;
  check('section_questions: 11 rows (seed)', _cnt = 11);

  -- Verify FK integrity of seeds
  SELECT COUNT(*) INTO _cnt FROM public.proposal_blueprints bp
  WHERE NOT EXISTS (SELECT 1 FROM public.business_categories bc WHERE bc.id = bp.business_category_id);
  check('Todos os blueprints referenciam categorias validas', _cnt = 0);

  SELECT COUNT(*) INTO _cnt FROM public.proposal_sections ps
  WHERE NOT EXISTS (SELECT 1 FROM public.proposal_blueprints bp WHERE bp.id = ps.blueprint_id);
  check('Todas as secoes referenciam blueprints validos', _cnt = 0);

  SELECT COUNT(*) INTO _cnt FROM public.section_questions sq
  WHERE NOT EXISTS (SELECT 1 FROM public.proposal_sections ps WHERE ps.id = sq.section_id);
  check('Todas as questoes referenciam secoes validas', _cnt = 0);

  -- ============================================================
  -- 11. SUMMARY
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '  RESULTADO: % passaram, % falharam', _pass, _fail;
  IF _fail = 0 THEN
    RAISE NOTICE '  STATUS:  TODOS OS TESTES PASSARAM';
  ELSE
    RAISE NOTICE '  STATUS:  % TESTES FALHARAM — investigar acima', _fail;
  END IF;
  RAISE NOTICE '============================================================';

END;
$$;