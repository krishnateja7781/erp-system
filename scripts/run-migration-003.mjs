// Run: node scripts/run-migration-003.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) envVars[key.trim()] = val.join('=').trim();
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const sql = readFileSync('scripts/migrations/003_classroom_notes.sql', 'utf8');

// Split into individual statements (skip comments, empty lines)
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s.length > 10);

async function run() {
  for (const stmt of statements) {
    // Skip storage bucket and policy statements (need service role)
    if (stmt.includes('storage.buckets') || stmt.includes('storage.objects')) {
      console.log('⏭ Skipping storage statement (needs manual run):', stmt.slice(0, 60) + '...');
      continue;
    }

    console.log('▶ Running:', stmt.slice(0, 80) + '...');
    const { error } = await supabase.rpc('exec_sql', { query: stmt });
    if (error) {
      console.log('  ❌ RPC failed:', error.message);
      console.log('  Trying alternative...');
    } else {
      console.log('  ✅ Success');
    }
  }

  // Test if table exists now
  const { error: testErr } = await supabase.from('classroom_notes').select('id').limit(1);
  if (testErr) {
    console.log('\n⚠️  Table still missing. Please run the SQL manually in Supabase SQL Editor:');
    console.log('   File: scripts/migrations/003_classroom_notes.sql');
  } else {
    console.log('\n✅ classroom_notes table is ready!');
  }
}

run();
