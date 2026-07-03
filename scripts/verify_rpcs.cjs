#!/usr/bin/env node
/**
 * Verify the 4 new RPCs work correctly on the live DB.
 */
const { Client } = require('pg');

const PROJECT_REF = 'ewlkdrwrespnxyddwtgo';
const DB_PASS = 'OperaOmnia#89';

async function main() {
  const conn = new Client({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASS,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await conn.connect();
  console.log('Conectado. A testar RPCs...\n');

  // 1. get_my_pending_invitations (should return empty for non-existent email)
  try {
    const r = await conn.query('SELECT * FROM get_my_pending_invitations($1)', ['nonexistent@test.com']);
    console.log('[OK] get_my_pending_invitations: retornou', r.rows.length, 'linhas (esperado: 0)');
  } catch (e) {
    console.log('[ERRO] get_my_pending_invitations:', e.message);
  }

  // 2. get_invitation_for_accept (should return empty for fake UUID)
  try {
    const r = await conn.query('SELECT * FROM get_invitation_for_accept($1, $2)', 
      ['00000000-0000-0000-0000-000000000000', 'nonexistent@test.com']);
    console.log('[OK] get_invitation_for_accept: retornou', r.rows.length, 'linhas (esperado: 0)');
  } catch (e) {
    console.log('[ERRO] get_invitation_for_accept:', e.message);
  }

  // 3. accept_invitation (should fail for fake invitation - expected behavior)
  try {
    await conn.query('SELECT accept_invitation($1, $2, $3)', 
      ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'test@test.com']);
    console.log('[ERRO] accept_invitation: deveria ter falhado para UUIDs falsos');
  } catch (e) {
    console.log('[OK] accept_invitation: corretamente rejeitou com:', e.message.substring(0, 80));
  }

  // 4. transfer_ownership (should fail for non-owner - expected behavior)
  try {
    await conn.query('SELECT transfer_ownership($1, $2)', 
      ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000']);
    console.log('[ERRO] transfer_ownership: deveria ter falhado para UUIDs falsos');
  } catch (e) {
    console.log('[OK] transfer_ownership: corretamente rejeitou com:', e.message.substring(0, 80));
  }

  // 5. Check pending invitations exist (for debugging the banner issue)
  try {
    const r = await conn.query(`
      SELECT i.id, i.email, i.role, i.accepted_at, i.expires_at, o.nome as org_nome
      FROM public.organization_invitations i
      JOIN public.organizations o ON o.id = i.organization_id
      WHERE i.accepted_at IS NULL
      ORDER BY i.created_at DESC
      LIMIT 10;
    `);
    console.log('\nConvites pendentes na DB:', r.rows.length);
    r.rows.forEach(row => {
      console.log(`  - ${row.email} | role: ${row.role} | org: ${row.org_nome} | expira: ${row.expires_at}`);
    });
  } catch (e) {
    console.log('[INFO] Nao foi possivel listar convites:', e.message.substring(0, 60));
  }

  // 6. Check existing members
  try {
    const r = await conn.query(`
      SELECT m.role, p.email, p.nome, o.nome as org_nome
      FROM public.organization_members m
      JOIN public.profiles p ON p.id = m.user_id
      JOIN public.organizations o ON o.id = m.organization_id
      ORDER BY m.joined_at;
    `);
    console.log('\nMembros existentes:', r.rows.length);
    r.rows.forEach(row => {
      console.log(`  - ${row.email} | ${row.nome || '(sem nome)'} | role: ${row.role} | org: ${row.org_nome}`);
    });
  } catch (e) {
    console.log('[INFO] Nao foi possivel listar membros:', e.message.substring(0, 60));
  }

  await conn.end();
  console.log('\n=== Testes concluidos ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });