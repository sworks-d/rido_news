// パイプライン手動実行
import { config } from 'dotenv';
config();

import { runRssCollector } from './agents/rss_collector.js';
import { runNewsWriter } from './agents/news_writer.js';
import { runQualityChecker } from './agents/quality_checker.js';
import { runRouteCollector } from './agents/route_collector.js';
import { runSpotCollector } from './agents/spot_collector.js';
import { runRouteWriter } from './agents/route_writer.js';
import { runSpotWriter } from './agents/spot_writer.js';
import { runScheduler } from './agents/scheduler.js';
import { notifyPipelineStart, notifyPipelineComplete, notifyAgentError } from './utils/discord.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getCurrentBriefingWeek() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - start) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const hour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
const week = getCurrentBriefingWeek();

console.log(`\n🚀 パイプライン手動実行 [${week}] ${hour}時\n`);

await notifyPipelineStart(hour);
const stats = {};

try {
  console.log('📡 RSS収集...');
  stats.rss = await runRssCollector(week);
  console.log('✅ RSS収集完了:', stats.rss);

  console.log('🗺️  ルート収集...');
  stats.route = await runRouteCollector(week, null);
  console.log('✅ ルート収集完了:', stats.route);

  console.log('📍 スポット収集...');
  stats.spot = await runSpotCollector(week, null);
  console.log('✅ スポット収集完了:', stats.spot);

  console.log('✍️  ニュース記事生成...');
  stats.news = await runNewsWriter(week);
  console.log('✅ ニュース生成完了:', stats.news);

  console.log('🛣️  ルート記事生成...');
  stats.routeWrite = await runRouteWriter(week);
  console.log('✅ ルート記事生成完了:', stats.routeWrite);

  console.log('📍 スポット記事生成...');
  stats.spotWrite = await runSpotWriter(week);
  console.log('✅ スポット記事生成完了:', stats.spotWrite);

  console.log('🔴 品質チェック...');
  stats.quality = await runQualityChecker(week);
  console.log('✅ 品質チェック完了:', stats.quality);

  console.log('📤 配信...');
  stats.scheduler = await runScheduler(week);
  console.log('✅ 配信完了:', stats.scheduler);

  await notifyPipelineComplete(hour, stats);
  console.log('\n✅ パイプライン完了');
} catch (err) {
  await notifyAgentError('pipeline', err.message);
  console.error('\n❌ パイプラインエラー:', err.message);
  console.error(err.stack);
}
