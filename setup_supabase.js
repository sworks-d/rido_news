// Supabase接続確認・テーブル作成スクリプト
// 実行方法: node setup_supabase.js

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConnection() {
  console.log('--- 1. Supabase接続確認 ---');
  try {
    const { data, error } = await supabase
      .from('user_routes')
      .select('id')
      .limit(1);

    if (error) throw error;
    console.log('✅ Supabase接続成功');
    return true;
  } catch (err) {
    console.error('❌ Supabase接続失敗:', err.message);
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEYを確認してください');
    return false;
  }
}

async function checkExistingTables() {
  console.log('\n--- 2. 既存テーブル確認 ---');
  const tables = [
    'user_routes', 'spots', 'profiles',
    'news_raw', 'news_articles', 'news_quality_log',
    'agent_runs', 'agent_status', 'agent_decisions',
    'agent_precision_log', 'weekly_briefings',
    'skills_update_log', 'skills_knowledge_log', 'themes_log'
  ];

  const results = { exists: [], missing: [] };

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      results.missing.push(table);
      console.log(`❌ ${table}: 未作成`);
    } else {
      results.exists.push(table);
      console.log(`✅ ${table}: 存在`);
    }
  }

  return results;
}

async function createTables() {
  console.log('\n--- 3. テーブル作成 ---');
  console.log('⚠️  supabase_tables.sqlをSupabaseのSQL Editorで実行してください');
  console.log('URL: https://supabase.com/dashboard/project/mzucyqqcistxmcrthaog/sql/new');
  console.log('ファイル: /Users/a05/rido_news/supabase_tables.sql');
}

async function main() {
  console.log('🚀 RIDO News Agent - Supabaseセットアップ確認\n');

  // service_role keyがダミーの場合はスキップ
  if (process.env.SUPABASE_SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEYがまだダミーです');
    console.log('接続確認をスキップします\n');
    await createTables();
    return;
  }

  const connected = await checkConnection();
  if (!connected) return;

  const { missing } = await checkExistingTables();

  if (missing.length > 0) {
    console.log(`\n未作成テーブル: ${missing.length}件`);
    await createTables();
  } else {
    console.log('\n✅ 全テーブル作成済み');
  }

  console.log('\n✅ セットアップ確認完了');
}

main();
