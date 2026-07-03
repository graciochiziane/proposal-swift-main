#!/usr/bin/env node
/**
 * Try connecting to Supabase via different pooler regions.
 * The direct connection only resolves to IPv6 (unreachable from sandbox).
 */
const { Client } = require('pg');

const PROJECT_REF = 'ewlkdrwrespnxyddwtgo';
const DB_PASS = 'OperaOmnia#89';

// Try multiple pooler regions
const REGIONS = [
  'aws-0-eu-central-1',
  'aws-1-eu-central-1',
  'aws-0-eu-west-1',
  'aws-1-eu-west-1',
  'aws-0-eu-west-2',
  'aws-0-eu-west-3',
  'aws-0-sa-east-1',
  'aws-0-us-east-1',
  'aws-1-us-east-1',
  'aws-0-ap-southeast-1',
  'aws-0-ap-northeast-1',
  'aws-0-af-south-1',
  'aws-0-me-south-1',
];

const PORTS = [6543, 5432];

async function tryConnect(host, port) {
  const client = new Client({
    host,
    port,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASS,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    await client.end();
    return { ok: true, host, port, version: res.rows[0].version.substring(0, 40) };
  } catch (e) {
    await client.end().catch(() => {});
    return { ok: false, host, port, error: e.code || e.message.substring(0, 60) };
  }
}

async function main() {
  console.log(`Procurando pooler acessivel para projeto ${PROJECT_REF}...\n`);
  
  // Try all combinations in parallel batches of 5
  const attempts = [];
  for (const region of REGIONS) {
    for (const port of PORTS) {
      attempts.push(tryConnect(`${region}.pooler.supabase.com`, port));
    }
  }

  // Process in batches
  const BATCH = 5;
  for (let i = 0; i < attempts.length; i += BATCH) {
    const batch = attempts.slice(i, i + BATCH);
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.ok) {
        console.log(`[OK] ${r.host}:${r.port} -> ${r.version}`);
      }
    }
  }

  console.log('\nBusca concluida.');
}

main().catch(e => console.error('Fatal:', e));