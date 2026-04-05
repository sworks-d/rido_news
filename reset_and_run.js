// reset_and_run.js
// 既存記事を全削除して本番パイプラインを走らせる
// 実行方法: node reset_and_run.js

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetAndRun() {
  console.log('=== 本番移行開始 ===\n');

  // 1. 既存データを全削除
  console.log('--- Step 1: 既存データを削除 ---');

  const tables = [
    'news_quality_log',
    'news_articles',
    'news_raw',
    'agent_runs',
    'agent_decisions',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除

    if (error) {
      console.error(`❌ ${table} 削除失敗:`, error.message);
    } else {
      console.log(`✅ ${table} 削除完了`);
    }
  }

  // agent_statusをリセット
  const { error: statusError } = await supabase
    .from('agent_status')
    .update({
      status: 'waiting',
      last_run_at: null,
      last_count: null,
      note: null,
      updated_at: new Date().toISOString(),
    })
    .neq('agent', '');

  if (statusError) {
    console.error('❌ agent_status リセット失敗:', statusError.message);
  } else {
    console.log('✅ agent_status リセット完了');
  }

  console.log('\n全データ削除完了。パイプラインを起動します...\n');

  // 2. パイプラインを実行
  console.log('--- Step 2: パイプライン実行 ---');

  const { runRssCollector } = await import('./agents/rss_collector.js');
  const { runNewsWriter } = await import('./agents/news_writer.js');
  const { runQualityChecker } = await import('./agents/quality_checker.js');
  const { runLegalChecker } = await import('./agents/legal_checker.js');
  const { runScheduler } = await import('./agents/scheduler.js');

  const week = getCurrentBriefingWeek();
  console.log(`ブリーフィング週: ${week}\n`);

  console.log('[1/5] RSS収集...');
  const rssStats = await runRssCollector(week);
  console.log(`  → ${rssStats.passed}件収集\n`);

  console.log('[2/5] 記事生成...');
  const writerStats = await runNewsWriter(week);
  console.log(`  → ${writerStats.passed}件生成\n`);

  console.log('[3/5] 品質チェック...');
  const qualityStats = await runQualityChecker(week);
  console.log(`  → 承認${qualityStats.approved}件 / 審査待ち${qualityStats.pendingReview}件\n`);

  console.log('[4/5] リーガルチェック...');
  const legalStats = await runLegalChecker(week);
  console.log(`  → 通過${legalStats.passed}件 / Fail${legalStats.failed}件\n`);

  console.log('[5/5] 配信スケジュール...');
  const schedulerStats = await runScheduler(week);
  console.log(`  → 承認待ち${schedulerStats.published}件\n`);

  console.log('=== 本番移行完了 ===');
  console.log('\nDiscordの#rido-alertで !list を実行して承認待ち記事を確認してください。');
  console.log('!approve [id] で記事を公開できます。');
}

function getCurrentBriefingWeek() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - start) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

resetAndRun().catch(console.error);
