const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ewlkdrwrespnxyddwtgo',
  password: 'OperaOmnia#89',
  ssl: { rejectUnauthorized: false },
});

const fs = require('fs');
const sql = fs.readFileSync('/home/z/my-project/proposal-swift-main/supabase/migrations/20260707010000_rls_org_scoped.sql', 'utf8');

// Split by lines, group by statement (separated by empty lines or ;)
function splitStatements(sql) {
  const lines = sql.split('\n');
  const stmts = [];
  let current = [];
  let inFunc = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue;

    if (trimmed.startsWith('CREATE OR REPLACE FUNCTION') || trimmed.startsWith('CREATE POLICY') || trimmed.startsWith('DROP POLICY')) {
      if (current.length > 0 && current.some(l => l.trim().endsWith(';'))) {
        stmts.push(current.join('\n'));
        current = [];
      }
      current.push(line);
      inFunc = trimmed.includes('FUNCTION');
    } else if (inFunc || trimmed !== '') {
      current.push(line);
      if (trimmed.endsWith('$$;')) inFunc = false;
    }

    if (trimmed.endsWith(';') && !inFunc) {
      stmts.push(current.join('\n'));
      current = [];
    }
  }

  if (current.length > 0) {
    const joined = current.join('\n');
    if (joined.trim().endsWith(';')) stmts.push(joined);
  }

  return stmts.filter(s => s.trim().length > 0);
}

async function run() {
  await client.connect();
  console.log('Connected to Supabase');

  const statements = splitStatements(sql);
  console.log(`Found ${statements.length} statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const preview = statements[i].replace(/\n/g, ' ').substring(0, 80);
    try {
      await client.query(statements[i]);
      console.log(`[${i + 1}/${statements.length}] OK: ${preview}...`);
    } catch (err) {
      console.error(`[${i + 1}/${statements.length}] FAILED: ${preview}...`);
      console.error(`  Error: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  console.log('\nAll RLS policies applied successfully');
  await client.end();
}

run();