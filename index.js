// RIDO News Agent - メイン起動スクリプト
// 実行方法: node index.js
// Claude Codeから: /loop で常駐実行

import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { runRssCollector } from './agents/rss_collector.js';
import { runNewsWriter } from './agents/news_writer.js';
import { runQualityChecker } from './agents/quality_checker.js';

config();

// ============================================
// 初期化
// ============================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const discord = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const CHANNELS = {
  alert: process.env.DISCORD_CHANNEL_ALERT,
  briefing: process.env.DISCORD_CHANNEL_BRIEFING,
  daily: process.env.DISCORD_CHANNEL_DAILY,
  status: process.env.DISCORD_CHANNEL_STATUS,
};

// ============================================
// Discord送信ユーティリティ
// ============================================
export async function sendDiscord(channelKey, message) {
  try {
    const channel = await discord.channels.fetch(CHANNELS[channelKey]);
    await channel.send(message);
    console.log(`[Discord] ${channelKey}: 送信完了`);
  } catch (err) {
    console.error(`[Discord] ${channelKey}: 送信失敗`, err.message);
  }
}

// ============================================
// Supabaseユーティリティ
// ============================================
export async function updateAgentStatus(agent, status, count = null, note = null) {
  const update = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (count !== null) update.last_count = count;
  if (note !== null) update.note = note;
  if (status === 'running') update.last_run_at = new Date().toISOString();

  const { error } = await supabase
    .from('agent_status')
    .update(update)
    .eq('agent', agent);

  if (error) console.error(`[Status] ${agent} 更新失敗:`, error.message);
}

export async function logAgentRun(agent, task, status, inputCount, outputCount, errorMsg = null, metadata = null) {
  const { error } = await supabase
    .from('agent_runs')
    .insert({
      agent,
      task,
      status,
      input_count: inputCount,
      output_count: outputCount,
      error_message: errorMsg,
      metadata,
      finished_at: new Date().toISOString(),
    });

  if (error) console.error(`[Log] ${agent} ログ記録失敗:`, error.message);
}

// ============================================
// ユーティリティ
// ============================================
function getCurrentBriefingWeek() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - start) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ============================================
// スケジューラー
// ============================================
function getJSTHour() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
}

function getJSTDay() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay();
}

function getJSTMinute() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMinutes();
}

// 現在時刻が指定時刻（JST）かチェック
function isTime(hour, minute = 0) {
  return getJSTHour() === hour && getJSTMinute() === minute;
}

// ============================================
// メインループ
// ============================================
let lastRunMinute = -1;

async function mainLoop() {
  const currentMinute = getJSTHour() * 60 + getJSTMinute();

  // 同じ分に複数回実行しない
  if (currentMinute === lastRunMinute) return;
  lastRunMinute = currentMinute;

  const hour = getJSTHour();
  const day = getJSTDay(); // 0=日, 1=月, ..., 6=土

  // ============================================
  // 月曜5時：週次リセット・ブリーフィング生成
  // ============================================
  if (day === 1 && isTime(5)) {
    console.log('[Scheduler] 週次リセット開始');
    await sendDiscord('status', '【週次リセット開始】月曜5時のサイクルを開始します。');

    // 参謀：週次ブリーフィング生成
    // → Claude Codeのサブエージェントとして実行
    // await runStrategistBriefing();

    // 艦長：タブバランス情報付加
    // await runEditorBalance();

    console.log('[Scheduler] 週次リセット完了');
  }

  // ============================================
  // 毎朝3時：ライフスタイル収集
  // ============================================
  if (isTime(3)) {
    console.log('[Scheduler] ライフスタイル収集開始');
    await updateAgentStatus('lifestyle_collector', 'running');

    // [Ph2以降] await runLifestyleCollector(); // ソースが揃ったら有効化

    await updateAgentStatus('lifestyle_collector', 'done');
    console.log('[Scheduler] ライフスタイル収集完了');
  }

  // ============================================
  // 6時間ごと（0・6・12・18時）：RSS収集→生成→品質→配信
  // ============================================
  if (isTime(0) || isTime(6) || isTime(12) || isTime(18)) {
    console.log(`[Scheduler] ${hour}時のパイプライン開始`);
    await sendDiscord('status', `【パイプライン開始】${hour}時のサイクルを開始します。`);

    // 収集フェーズ
    await updateAgentStatus('rss_collector', 'running');
    await runRssCollector(getCurrentBriefingWeek());
    await updateAgentStatus('rss_collector', 'done');

    await updateAgentStatus('route_collector', 'running');
    // await runRouteCollector();
    await updateAgentStatus('route_collector', 'done');

    await updateAgentStatus('spot_collector', 'running');
    // await runSpotCollector();
    await updateAgentStatus('spot_collector', 'done');

    // 生成フェーズ
    await updateAgentStatus('news_writer', 'running');
    await runNewsWriter(getCurrentBriefingWeek());
    await updateAgentStatus('news_writer', 'done');

    await updateAgentStatus('route_writer', 'running');
    // await runRouteWriter();
    await updateAgentStatus('route_writer', 'done');

    await updateAgentStatus('spot_writer', 'running');
    // await runSpotWriter();
    await updateAgentStatus('spot_writer', 'done');

    // 品質フェーズ
    await updateAgentStatus('quality_checker', 'running');
    await runQualityChecker(getCurrentBriefingWeek());
    await updateAgentStatus('quality_checker', 'done');

    // 配信フェーズ
    await updateAgentStatus('scheduler', 'running');
    // await runScheduler();
    await updateAgentStatus('scheduler', 'done');

    console.log(`[Scheduler] ${hour}時のパイプライン完了`);
    await sendDiscord('status', `【パイプライン完了】${hour}時のサイクルが完了しました。`);
  }

  // ============================================
  // 金曜18時：週末モード強化配信
  // ============================================
  if (day === 5 && isTime(18)) {
    console.log('[Scheduler] 週末モード強化配信開始');
    await sendDiscord('briefing', '【週末モード】金曜18時の強化配信を開始します。');
    // await runWeekendMode();
  }

  // ============================================
  // 毎朝7時：日次レポート
  // ============================================
  if (isTime(7)) {
    console.log('[Scheduler] 日次レポート送信');
    // await runDailyReport();
  }

  // ============================================
  // 月曜8時：週次レポート
  // ============================================
  if (day === 1 && isTime(8)) {
    console.log('[Scheduler] 週次レポート送信');
    // await runWeeklyReport();
  }
}

// ============================================
// 起動
// ============================================
discord.once('clientReady', async () => {
  console.log(`✅ RIDO News Agent起動完了: ${discord.user.tag}`);
  await sendDiscord('status', '【起動】RIDO News Agentが起動しました。');

  // 1分ごとにループ実行
  setInterval(mainLoop, 60 * 1000);

  // 起動直後に1回実行
  await mainLoop();
});

discord.on('error', (err) => {
  console.error('Discord接続エラー:', err.message);
});

discord.login(process.env.DISCORD_BOT_TOKEN);
