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

  // Check get_my_pending_invitations RPC definition
  console.log('--- get_my_pending_invitations RPC ---');
  const rpc = await client.query(`
    SELECT routine_definition FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_my_pending_invitations'
  `);
  if (rpc.rows.length > 0) {
    const def = rpc.rows[0].routine_definition;
    console.log(`Retorna i.nome: ${def.includes('i.nome') ? 'SIM' : 'NAO - BUG C pendente'}`);
  }

  // Check get_invitation_by_token RPC
  console.log('\n--- get_invitation_by_token RPC ---');
  const rpc2 = await client.query(`
    SELECT routine_definition FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_invitation_by_token'
  `);
  if (rpc2.rows.length > 0) {
    const def = rpc2.rows[0].routine_definition;
    console.log(`Retorna i.nome: ${def.includes('i.nome') ? 'SIM' : 'NAO'}`);
  }

  // Check enforce_proposal_limit trigger
  console.log('\n--- enforce_proposal_limit trigger ---');
  const trigger = await client.query(`
    SELECT routine_definition FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'enforce_proposal_limit'
  `);
  if (trigger.rows.length > 0) {
    const def = trigger.rows[0].routine_definition;
    console.log(`Usa user_org_id: ${def.includes('user_org_id') ? 'SIM (aceitavel - trigger, nao RLS)' : 'NAO'}`);
  }

  // Check handle_new_user trigger
  console.log('\n--- handle_new_user trigger ---');
  const handleNewUser = await client.query(`
    SELECT routine_definition FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'handle_new_user'
  `);
  if (handleNewUser.rows.length > 0) {
    const def = handleNewUser.rows[0].routine_definition;
    console.log(`Usa user_org_id: ${def.includes('user_org_id') ? 'SIM (aceitavel - trigger)' : 'NAO'}`);
    console.log(`Cria org pessoal: ${def.includes('INSERT INTO public.organizations') ? 'SIM' : 'NAO'}`);
    console.log(`Cria membership owner: ${def.includes("role = 'owner'") || def.includes("role::org_role") ? 'SIM' : 'NAO'}`);
  }

  await client.end();
}

run();