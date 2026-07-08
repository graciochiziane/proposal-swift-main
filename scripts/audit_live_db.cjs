const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ewlkdrwrespnxyddwtgo',
  password: 'OperaOmnia#89',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('=== AUDITORIA LIVE DB ===\n');

  // 1. Check new RLS functions exist
  console.log('--- 1. Novas funcoes RLS ---');
  const funcs = await client.query(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN ('user_belongs_to_org', 'user_role_in_org')
    ORDER BY routine_name
  `);
  console.log(`user_belongs_to_org: ${funcs.rows.find(r => r.routine_name === 'user_belongs_to_org') ? 'EXISTS' : 'MISSING'}`);
  console.log(`user_role_in_org: ${funcs.rows.find(r => r.routine_name === 'user_role_in_org') ? 'EXISTS' : 'MISSING'}`);

  // 2. Check NO active RLS policy uses user_org_id
  console.log('\n--- 2. Políticas RLS que ainda usam user_org_id ---');
  const badPolicies = await client.query(`
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies 
    WHERE qual LIKE '%user_org_id%' 
       OR with_check LIKE '%user_org_id%'
       OR qual LIKE '%user_org_role%'
       OR with_check LIKE '%user_org_role%'
    ORDER BY tablename, policyname
  `);
  if (badPolicies.rows.length === 0) {
    console.log('ZERO politicas usam user_org_id ou user_org_role. LIMPO.');
  } else {
    console.log(`ATENCAO: ${badPolicies.rows.length} politicas ainda usam funcoes antigas:`);
    badPolicies.rows.forEach(r => {
      console.log(`  ${r.tablename}.${r.policyname}`);
    });
  }

  // 3. Check new columns exist
  console.log('\n--- 3. Colunas novas ---');
  const cols = await client.query(`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (
      (table_name = 'organization_members' AND column_name = 'display_name')
      OR (table_name = 'organization_invitations' AND column_name = 'nome')
    )
    ORDER BY table_name, column_name
  `);
  cols.rows.forEach(r => {
    console.log(`${r.table_name}.${r.column_name} (${r.data_type}, default: ${r.column_default})`);
  });
  if (cols.rows.length < 2) {
    console.log('ATENCAO: coluna em falta!');
  }

  // 4. Check accept_invitation RPC includes display_name
  console.log('\n--- 4. RPC accept_invitation ---');
  const rpc = await client.query(`
    SELECT routine_definition FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'accept_invitation'
  `);
  if (rpc.rows.length > 0) {
    const def = rpc.rows[0].routine_definition;
    const hasDisplayName = def.includes('display_name');
    const hasInviteNome = def.includes('v_invite.nome');
    console.log(`Contem display_name: ${hasDisplayName ? 'SIM' : 'NAO'}`);
    console.log(`Contem v_invite.nome: ${hasInviteNome ? 'SIM' : 'NAO'}`);
  } else {
    console.log('MISSING: RPC nao encontrado!');
  }

  // 5. Check profiles_select_org uses EXISTS + user_belongs_to_org
  console.log('\n--- 5. Policy profiles_select_org ---');
  const profilePolicy = await client.query(`
    SELECT qual FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_org'
  `);
  if (profilePolicy.rows.length > 0) {
    const q = profilePolicy.rows[0].qual;
    console.log(`Usa user_belongs_to_org: ${q.includes('user_belongs_to_org') ? 'SIM' : 'NAO'}`);
    console.log(`Usa EXISTS: ${q.includes('EXISTS') ? 'SIM' : 'NAO'}`);
    console.log(`Usa organization_id = (old): ${q.includes('organization_id =') && !q.includes('EXISTS') ? 'SIM - BUG' : 'NAO'}`);
  } else {
    console.log('MISSING!');
  }

  // 6. List ALL active RLS policies for key tables
  console.log('\n--- 6. Todas as políticas RLS activas (tabelas de negócio) ---');
  const allPolicies = await client.query(`
    SELECT tablename, policyname, cmd 
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN ('proposals','clients','catalog_items','invoices','invoice_items','proposal_items','organizations','organization_members','organization_invitations','profiles','proposta_ai','subscriptions')
    ORDER BY tablename, policyname
  `);
  let lastTable = '';
  allPolicies.rows.forEach(r => {
    if (r.tablename !== lastTable) {
      console.log(`\n  ${r.tablename}:`);
      lastTable = r.tablename;
    }
    console.log(`    ${r.policyname} (${r.cmd})`);
  });

  // 7. Count RLS-enabled tables
  console.log('\n--- 7. Tabelas com RLS activo ---');
  const rlsTables = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = true
    ORDER BY tablename
  `);
  rlsTables.rows.forEach(r => {
    console.log(`  ${r.tablename}: RLS ON`);
  });

  // 8. Functional test: call user_belongs_to_org with a real org
  console.log('\n--- 8. Teste funcional ---');
  try {
    const testOrg = await client.query(`
      SELECT organization_id FROM public.organization_members LIMIT 1
    `);
    if (testOrg.rows.length > 0) {
      const orgId = testOrg.rows[0].organization_id;
      const testResult = await client.query(`SELECT public.user_belongs_to_org('${orgId}'::uuid)`);
      // Will return NULL/false because no auth context, but function should not error
      console.log(`user_belongs_to_org('${orgId}'): chamou sem erro (sem auth context = null, esperado)`);
    } else {
      console.log('Sem members para testar (tabela vazia)');
    }
  } catch (err) {
    console.log(`ERRO: ${err.message}`);
  }

  await client.end();
  console.log('\n=== FIM DA AUDITORIA ===');
}

run();