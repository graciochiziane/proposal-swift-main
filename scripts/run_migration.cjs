const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'db.ewlkdrwrespnxyddwtgo.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'OperaOmnia#89',
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('/home/z/my-project/supabase/migrations/20260807000000_advanced_proposals_blueprint_engine.sql', 'utf8');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration executed successfully');
    
    const tables = ['business_categories', 'proposal_blueprints', 'proposal_sections', 'section_questions', 'company_brand_profiles', 'advanced_proposals', 'proposal_section_answers'];
    for (const t of tables) {
      const res = await client.query('SELECT count(*) FROM ' + t);
      console.log(t + ': ' + res.rows[0].count + ' rows');
    }
    
    // Verify RLS
    const rls = await client.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('business_categories','proposal_blueprints','proposal_sections','section_questions','company_brand_profiles','advanced_proposals','proposal_section_answers') ORDER BY tablename");
    console.log('\nRLS status:');
    rls.rows.forEach(r => console.log('  ' + r.tablename + ': ' + r.rowsecurity));
    
    // Verify blueprint_id column on proposals
    const col = await client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='proposals' AND column_name='blueprint_id'");
    console.log('\nproposals.blueprint_id: ' + (col.rows.length ? 'added (nullable=' + col.rows[0].is_nullable + ')' : 'NOT FOUND'));
    
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

run();
