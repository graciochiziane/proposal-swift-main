-- ============================================================
-- AUDIT: Blueprint Engine Migration
-- Run this AFTER the migration to validate everything.
-- ============================================================

DO $$
DECLARE
  _pass INT := 0;
  _fail INT := 0;
  _cnt  INT;
  _exists BOOLEAN;
  _name TEXT;
  _ok   BOOLEAN;
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

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visual_style') INTO _ok;
  IF _ok THEN _pass := _pass + 1; RAISE NOTICE '[PASS] Enum public.visual_style';
  ELSE _fail := _fail + 1; RAISE NOTICE '[FAIL] Enum public.visual_style'; END IF;

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') INTO _ok;
  IF _ok THEN _pass := _pass + 1; RAISE NOTICE '[PASS] Enum public.org_role';
  ELSE _fail := _fail + 1; RAISE NOTICE '[FAIL] Enum public.org_role'; END IF;

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') INTO _ok;
  IF _ok THEN _pass := _pass + 1; RAISE NOTICE '[PASS] Enum public.app_role';
  ELSE _fail := _fail + 1; RAISE NOTICE '[FAIL] Enum public.app_role'; END IF;

  -- ============================================================
  -- 2. HELPER FUNCTIONS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 2. HELPER FUNCTIONS ---';

  _name := 'Funcao has_role(uuid,text) existe';
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='has_role') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Funcao user_role_in_org(uuid) existe';
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='user_role_in_org') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Funcao user_belongs_to_org(uuid) existe';
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='user_belongs_to_org') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Funcao has_org_role_min_in_org(uuid,org_role) existe';
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='has_org_role_min_in_org') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Funcao set_updated_at() existe';
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='set_updated_at') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  -- Security definer check
  _name := 'Todas as 5 funcoes sao SECURITY DEFINER';
  SELECT COUNT(*) INTO _cnt FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE n.nspname='public' AND p.proname IN ('has_role','user_role_in_org','user_belongs_to_org','has_org_role_min_in_org','set_updated_at') AND p.prosecdef=true;
  IF _cnt=5 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (encontradas %)', _name, _cnt; END IF;

  -- ============================================================
  -- 3. TABELAS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 3. TABELAS ---';

  _name := 'Tabela business_categories';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='business_categories') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Tabela proposal_blueprints';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='proposal_blueprints') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Tabela proposal_sections';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='proposal_sections') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Tabela section_questions';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='section_questions') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Tabela company_brand_profiles';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company_brand_profiles') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Tabela advanced_proposals';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='advanced_proposals') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'Tabela proposal_section_answers';
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='proposal_section_answers') INTO _ok;
  IF _ok THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  -- ============================================================
  -- 4. COLUNAS CRITICAS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 4. COLUNAS CRITICAS ---';

  _name := 'business_categories: 6 colunas essenciais';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='business_categories' AND column_name IN ('id','name','slug','icon','sort_order','active');
  IF _cnt=6 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_blueprints: 6 colunas essenciais';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='proposal_blueprints' AND column_name IN ('id','name','business_category_id','version','is_default','active');
  IF _cnt=6 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_sections: 5 colunas essenciais';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='proposal_sections' AND column_name IN ('id','blueprint_id','type','title','content_rules');
  IF _cnt=5 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'section_questions: placeholder (nao help_text)';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='section_questions' AND column_name='placeholder';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'company_brand_profiles: organization_id + visual_style';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='company_brand_profiles' AND column_name IN ('organization_id','visual_style');
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'advanced_proposals: 7 colunas essenciais';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='advanced_proposals' AND column_name IN ('id','organization_id','owner_id','client_id','blueprint_id','status','brand_profile_id');
  IF _cnt=7 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_section_answers: 6 colunas essenciais';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='proposal_section_answers' AND column_name IN ('id','advanced_proposal_id','section_id','answers','ai_content','content_status');
  IF _cnt=6 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposals.blueprint_id (ALTER TABLE)';
  SELECT COUNT(*) INTO _cnt FROM information_schema.columns WHERE table_schema='public' AND table_name='proposals' AND column_name='blueprint_id';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  -- ============================================================
  -- 5. FOREIGN KEYS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 5. FOREIGN KEYS ---';

  _name := 'FK: proposal_blueprints -> business_categories';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='proposal_blueprints';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'FK: proposal_sections -> proposal_blueprints';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='proposal_sections';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'FK: section_questions -> proposal_sections';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='section_questions';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'FK: company_brand_profiles -> organizations';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='company_brand_profiles';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'FK: advanced_proposals -> organizations';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='advanced_proposals';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'FK: advanced_proposals -> auth.users (owner_id)';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='advanced_proposals';
  IF _cnt>=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (FKs: %)', _name, _cnt; END IF;

  _name := 'FK: proposal_section_answers -> advanced_proposals';
  SELECT COUNT(*) INTO _cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public' AND table_name='proposal_section_answers';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  -- ============================================================
  -- 6. CHECK CONSTRAINTS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 6. CHECK CONSTRAINTS ---';

  _name := 'advanced_proposals: CHECK (status)';
  SELECT COUNT(*) INTO _cnt FROM pg_constraint con JOIN pg_class c ON con.conrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='advanced_proposals' AND con.contype='c';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'proposal_section_answers: CHECK (content_status)';
  SELECT COUNT(*) INTO _cnt FROM pg_constraint con JOIN pg_class c ON con.conrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='proposal_section_answers' AND con.contype='c';
  IF _cnt>=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  -- ============================================================
  -- 7. INDEXES
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 7. INDEXES ---';

  _name := 'idx_business_categories_active';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname='idx_business_categories_active';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'idx_blueprints_category';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname='idx_blueprints_category';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'idx_proposal_sections_blueprint';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname='idx_proposal_sections_blueprint';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'idx_section_questions_section';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname='idx_section_questions_section';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'idx_brand_profiles_org';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname='idx_brand_profiles_org';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  _name := 'idx_advanced_proposals (org + owner)';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_advanced_proposals%';
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'idx_section_answers (proposal + status)';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_section_answers%';
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'idx_proposals_blueprint_id';
  SELECT COUNT(*) INTO _cnt FROM pg_indexes WHERE schemaname='public' AND indexname='idx_proposals_blueprint_id';
  IF _cnt=1 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] %', _name; END IF;

  -- ============================================================
  -- 8. TRIGGERS
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 8. TRIGGERS ---';

  _name := '7 triggers set_updated_at';
  SELECT COUNT(*) INTO _cnt FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers') AND t.tgname LIKE 'trg_%_updated_at' AND NOT t.tgisinternal;
  IF _cnt=7 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  -- ============================================================
  -- 9. RLS + POLICIES
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 9. RLS + POLICIES ---';

  _name := 'Todas as 7 tabelas tem RLS enabled';
  SELECT COUNT(DISTINCT c.relname) INTO _cnt FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers') AND c.relrowsecurity=true;
  IF _cnt=7 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'business_categories: 2 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='business_categories';
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_blueprints: 2 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='proposal_blueprints';
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_sections: 2 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='proposal_sections';
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'section_questions: 2 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='section_questions';
  IF _cnt=2 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'company_brand_profiles: 4 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='company_brand_profiles';
  IF _cnt=4 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'advanced_proposals: 4 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='advanced_proposals';
  IF _cnt=4 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_section_answers: 4 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='proposal_section_answers';
  IF _cnt=4 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'Total: 20 policies';
  SELECT COUNT(*) INTO _cnt FROM pg_policies p JOIN pg_class c ON p.polrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND c.relname IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers');
  IF _cnt=20 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  -- ============================================================
  -- 10. SEED DATA
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- 10. SEED DATA ---';

  _name := 'business_categories: 3 rows';
  SELECT COUNT(*) INTO _cnt FROM public.business_categories;
  IF _cnt=3 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_blueprints: 3 rows';
  SELECT COUNT(*) INTO _cnt FROM public.proposal_blueprints;
  IF _cnt=3 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'proposal_sections: 15 rows';
  SELECT COUNT(*) INTO _cnt FROM public.proposal_sections;
  IF _cnt=15 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'section_questions: 11 rows';
  SELECT COUNT(*) INTO _cnt FROM public.section_questions;
  IF _cnt=11 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  -- FK integrity
  _name := 'Seeds: blueprints -> categorias validas';
  SELECT COUNT(*) INTO _cnt FROM public.proposal_blueprints bp WHERE NOT EXISTS (SELECT 1 FROM public.business_categories bc WHERE bc.id=bp.business_category_id);
  IF _cnt=0 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'Seeds: secoes -> blueprints validos';
  SELECT COUNT(*) INTO _cnt FROM public.proposal_sections ps WHERE NOT EXISTS (SELECT 1 FROM public.proposal_blueprints bp WHERE bp.id=ps.blueprint_id);
  IF _cnt=0 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  _name := 'Seeds: questoes -> secoes validas';
  SELECT COUNT(*) INTO _cnt FROM public.section_questions sq WHERE NOT EXISTS (SELECT 1 FROM public.proposal_sections ps WHERE ps.id=sq.section_id);
  IF _cnt=0 THEN _pass:=_pass+1; RAISE NOTICE '[PASS] %', _name; ELSE _fail:=_fail+1; RAISE NOTICE '[FAIL] % (%)', _name, _cnt; END IF;

  -- ============================================================
  -- RESULTADO
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
