#!/usr/bin/env node
/**
 * Check existing RPCs in live Supabase DB and apply missing migrations.
 * Uses node pg module with IPv4-only DNS resolution.
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'db.ewlkdrwrespnxyddwtgo.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'OperaOmnia#89',
  ssl: { rejectUnauthorized: false },
  // Force IPv4: custom DNS resolution
  family: 4,  // This tells pg to use IPv4
  connectionTimeoutMillis: 15000,
};

const MIGRATIONS_DIR = '/home/z/my-project/proposal-swift-main/supabase/migrations';
const fs = require('fs');

async function main() {
  let conn;
  
  console.log('=== Conectando ao Supabase DB (IPv4) ===');
  try {
    conn = new Client(DB_CONFIG);
    await conn.connect();
    console.log('  Conexao OK');
  } catch (e) {
    console.log('  FALHA:', e.message);
    // Try pooler as fallback
    console.log('\n  Tentando via Supabase Pooler...');
    try {
      conn = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 6543,
        database: 'postgres',
        user: 'postgres.ewlkdrwrespnxyddwtgo',
        password: 'OperaOmnia#89',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
      await conn.connect();
      console.log('  Conexao via Pooler OK');
    } catch (e2) {
      console.log('  FALHA Pooler:', e2.message);
      process.exit(1);
    }
  }

  try {
    // Check existing RPCs
    console.log('\n=== Verificando estado da DB ===');
    const rpcResult = await conn.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_name IN (
          'get_my_pending_invitations',
          'get_invitation_for_accept',
          'accept_invitation',
          'transfer_ownership',
          'get_invitation_by_token'
        )
      ORDER BY routine_name;
    `);
    const existing = rpcResult.rows.map(r => r.routine_name);
    console.log('  RPCs existentes:', existing.length ? existing.join(', ') : 'nenhum');

    // Check token column
    const colResult = await conn.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_invitations'
        AND column_name = 'token';
    `);
    const hasToken = colResult.rows.length > 0;
    console.log("  Coluna 'token' em organization_invitations:", hasToken ? 'SIM' : 'NAO');

    // Check org_role enum exists
    const enumResult = await conn.query(`
      SELECT t.typname FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'org_role';
    `);
    const hasEnum = enumResult.rows.length > 0;
    console.log("  Enum 'org_role':", hasEnum ? 'SIM' : 'NAO');

    const applied = [];

    // 1. invite_token.sql
    const needsTokenSql = !hasToken || !existing.includes('get_invitation_by_token');
    if (needsTokenSql) {
      const reason = !hasToken ? 'coluna token ausente' : 'RPC get_invitation_by_token ausente';
      console.log(`\n  -> Precisa aplicar: invite_token.sql (${reason})`);
      console.log('\n=== Aplicando invite_token.sql ===');
      try {
        const sql = fs.readFileSync(`${MIGRATIONS_DIR}/invite_token.sql`, 'utf8');
        await conn.query(sql);
        console.log('  [OK] invite_token.sql aplicado com sucesso');
        applied.push('invite_token.sql');
      } catch (e) {
        console.log('  [ERRO] invite_token.sql falhou:', e.message);
      }
    }

    // 2. fix_invitee_select_rpc.sql
    const neededRpcs = [
      'get_my_pending_invitations',
      'get_invitation_for_accept',
      'accept_invitation',
      'transfer_ownership'
    ];
    const missingRpcs = neededRpcs.filter(r => !existing.includes(r));
    
    if (missingRpcs.length > 0) {
      console.log(`\n  -> Precisa aplicar: fix_invitee_select_rpc.sql (RPCs em falta: ${missingRpcs.join(', ')})`);
      console.log('\n=== Aplicando fix_invitee_select_rpc.sql ===');
      try {
        const sql = fs.readFileSync(`${MIGRATIONS_DIR}/fix_invitee_select_rpc.sql`, 'utf8');
        await conn.query(sql);
        console.log('  [OK] fix_invitee_select_rpc.sql aplicado com sucesso');
        applied.push('fix_invitee_select_rpc.sql');
      } catch (e) {
        console.log('  [ERRO] fix_invitee_select_rpc.sql falhou:', e.message);
      }
    }

    // Post-apply verification
    if (applied.length > 0) {
      console.log('\n=== Verificacao pos-aplicacao ===');
      const postRpcs = await conn.query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
          AND routine_name IN ('get_my_pending_invitations','get_invitation_for_accept','accept_invitation','transfer_ownership','get_invitation_by_token')
        ORDER BY routine_name;
      `);
      console.log('  RPCs agora existentes:', postRpcs.rows.map(r => r.routine_name).join(', '));
      
      const postCol = await conn.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_invitations' AND column_name = 'token';
      `);
      console.log("  Coluna 'token':", postCol.rows.length > 0 ? 'SIM' : 'NAO');
    }

    if (applied.length === 0) {
      console.log('\n=== Tudo ja esta aplicado. Nenhuma migracao necessaria. ===');
    }

    console.log('\n=== Concluido ===');
  } finally {
    await conn.end();
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});