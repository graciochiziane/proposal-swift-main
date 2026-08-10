import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:OperaOmnia%2389@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = readFileSync('/home/z/my-project/supabase/migrations/20260807000000_advanced_proposals_blueprint_engine.sql', 'utf8');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration executed successfully');
    
    // Verify tables
    const tables = ['business_categories', 'proposal_blueprints', 'proposal_sections', 'section_questions', 'company_brand_profiles', 'advanced_proposals', 'proposal_section_answers'];
    for (const t of tables) {
      const res = await client.query('SELECT count(*) FROM ' + t);
      console.log(t + ': ' + res.rows[0].count + ' rows');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

run();
