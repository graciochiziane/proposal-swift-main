#!/usr/bin/env node
/**
 * Apply updated accept_invitation RPC (multi-org support) to live DB.
 */
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const conn = new Client({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.ewlkdrwrespnxyddwtgo',
    password: 'OperaOmnia#89',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await conn.connect();
  console.log('Conectado.');

  // Read and apply the updated SQL
  const sql = fs.readFileSync('/home/z/my-project/proposal-swift-main/supabase/migrations/fix_invitee_select_rpc.sql', 'utf8');
  
  try {
    await conn.query(sql);
    console.log('[OK] RPCs actualizados (multi-org enabled)');
  } catch (e) {
    console.log('[ERRO]:', e.message);
  }

  // Verify: accept_invitation should NOT have the multi-org check anymore
  const { rows } = await conn.query(`
    SELECT prosrc FROM pg_proc
    WHERE proname = 'accept_invitation' AND pronamespace = 'public'::regnamespace;
  `);
  if (rows.length > 0) {
    const src = rows[0].prosrc;
    const hasMultiOrgCheck = src.includes('Ja pertence a outra organizacao');
    const hasConditionalProfile = src.includes('AND organization_id IS NULL');
    console.log('\nVerificacao:');
    console.log('  Multi-org block removido:', !hasMultiOrgCheck ? 'SIM' : 'NAO');
    console.log('  Profile update condicional:', hasConditionalProfile ? 'SIM' : 'NAO');
  }

  await conn.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });