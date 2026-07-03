#!/usr/bin/env node
/**
 * Apply missing SQL migrations to Supabase live DB via pooler.
 */
const { Client } = require('pg');
const fs = require('fs');

const PROJECT_REF = 'ewlkdrwrespnxyddwtgo';
const DB_PASS = 'OperaOmnia#89';
const MIGRATIONS_DIR = '/home/z/my-project/proposal-swift-main/supabase/migrations';

function makeClient() {
  return new Client({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASS,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function main() {
  console.log('=== Conectando ao Supabase via Pooler ===');
  const conn = makeClient();
  try {
    await conn.connect();
    console.log('  Conexao OK\n');
  } catch (e) {
    console.log('  FALHA:', e.message);
    process.exit(1);
  }

  try {
    // 1. Check existing state
    console.log('=== Verificando estado da DB ===');
    const rpcRes = await conn.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
        AND routine_name IN (
          'get_my_pending_invitations','get_invitation_for_accept',
          'accept_invitation','transfer_ownership','get_invitation_by_token'
        )
      ORDER BY routine_name;
    `);
    const existing = rpcRes.rows.map(r => r.routine_name);
    console.log('  RPCs existentes:', existing.length ? existing.join(', ') : 'nenhum');

    const colRes = await conn.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='organization_invitations' AND column_name='token';
    `);
    const hasToken = colRes.rows.length > 0;
    console.log("  Coluna 'token':", hasToken ? 'SIM' : 'NAO');

    // Check enum
    const enumRes = await conn.query(`
      SELECT t.typname FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'org_role';
    `);
    console.log("  Enum 'org_role':", enumRes.rows.length > 0 ? 'SIM' : 'NAO');

    // Check table exists
    const tblRes = await conn.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name='organization_invitations';
    `);
    console.log("  Tabela 'organization_invitations':", tblRes.rows.length > 0 ? 'SIM' : 'NAO');

    const applied = [];

    // 2. Apply invite_token.sql if needed
    const needsTokenSql = !hasToken || !existing.includes('get_invitation_by_token');
    if (needsTokenSql) {
      const reason = !hasToken ? 'coluna token ausente' : 'RPC get_invitation_by_token ausente';
      console.log(`\n  -> Precisa aplicar: invite_token.sql (${reason})`);
      console.log('\n=== Aplicando invite_token.sql ===');
      try {
        const sql = fs.readFileSync(`${MIGRATIONS_DIR}/invite_token.sql`, 'utf8');
        await conn.query(sql);
        console.log('  [OK] invite_token.sql aplicado');
        applied.push('invite_token.sql');
      } catch (e) {
        console.log('  [ERRO] invite_token.sql:', e.message);
      }
    }

    // 3. Apply fix_invitee_select_rpc.sql if needed
    const neededRpcs = [
      'get_my_pending_invitations',
      'get_invitation_for_accept',
      'accept_invitation',
      'transfer_ownership'
    ];
    const missing = neededRpcs.filter(r => !existing.includes(r));
    if (missing.length > 0) {
      console.log(`\n  -> Precisa aplicar: fix_invitee_select_rpc.sql (${missing.join(', ')})`);
      console.log('\n=== Aplicando fix_invitee_select_rpc.sql ===');
      try {
        const sql = fs.readFileSync(`${MIGRATIONS_DIR}/fix_invitee_select_rpc.sql`, 'utf8');
        await conn.query(sql);
        console.log('  [OK] fix_invitee_select_rpc.sql aplicado');
        applied.push('fix_invitee_select_rpc.sql');
      } catch (e) {
        console.log('  [ERRO] fix_invitee_select_rpc.sql:', e.message);
      }
    }

    // 4. Post-apply verification
    if (applied.length > 0) {
      console.log('\n=== Verificacao pos-aplicacao ===');
      const postRes = await conn.query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema='public' AND routine_type='FUNCTION'
          AND routine_name IN (
            'get_my_pending_invitations','get_invitation_for_accept',
            'accept_invitation','transfer_ownership','get_invitation_by_token'
          )
        ORDER BY routine_name;
      `);
      console.log('  RPCs agora existentes:', postRes.rows.map(r => r.routine_name).join(', '));

      const postCol = await conn.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='organization_invitations' AND column_name='token';
      `);
      console.log("  Coluna 'token':", postCol.rows.length > 0 ? 'SIM' : 'NAO');
    } else {
      console.log('\n=== Tudo ja esta aplicado. ===');
    }

    console.log('\n=== Concluido ===');
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });