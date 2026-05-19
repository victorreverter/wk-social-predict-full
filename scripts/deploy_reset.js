const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
const sql = readFileSync('supabase/reset_tournament.sql', 'utf8');

(async () => {
  const { error } = await s.rpc('__exec_sql', { query: sql });
  if (error) {
    console.log('__exec_sql not available:', error.message);
    console.log('\nRun this manually in the Supabase SQL Editor:\n');
    console.log(sql);
  } else {
    console.log('✅ reset_tournament deployed successfully');
  }
})().catch(e => console.error(e));
