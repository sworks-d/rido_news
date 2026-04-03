// test_discord_notify.js
// Discord通知の疎通確認
// 実行方法: node test_discord_notify.js

import {
  notifyStartup, notifyPipelineStart, notifyPipelineComplete,
  notifyAlert, notifyLayer1, notifyAgentError, notifyFallback,
  notifyDailyReport, notifyWeeklyReport
} from './utils/discord.js';

async function main() {
  console.log('Discord通知テスト開始...\n');

  console.log('[1] 起動通知 → #rido-status');
  await notifyStartup();
  await sleep(500);

  console.log('[2] パイプライン開始 → #rido-status');
  await notifyPipelineStart(6);
  await sleep(500);

  console.log('[3] パイプライン完了 → #rido-status');
  await notifyPipelineComplete(6, {
    rss: { passed: 35 },
    news: { passed: 12 },
    quality: { approved: 10, pendingReview: 2 },
    scheduler: { published: 10 },
  });
  await sleep(500);

  console.log('[4] Layer1アラート → #rido-alert');
  await notifyLayer1(
    'カワサキ新型モデル発表',
    '著作権リスク: summary/body比率超過 (22%)',
    'https://news.webike.net/xxx'
  );
  await sleep(500);

  console.log('[5] フォールバック通知 → #rido-alert');
  await notifyFallback('spot_collector', '東北エリアのユーザー数が0件 → 全国フォールバックモードで実行');
  await sleep(500);

  console.log('[6] エージェントエラー → #rido-alert');
  await notifyAgentError('news_writer', 'Anthropic API timeout after 30s');
  await sleep(500);

  console.log('[7] 日次レポート → #rido-daily');
  await notifyDailyReport({
    collected: 47,
    generated: 15,
    approved: 12,
    pendingReview: 2,
    errors: 1,
  });
  await sleep(500);

  console.log('[8] 週次レポート → #rido-briefing');
  await notifyWeeklyReport({
    totalPublished: 84,
    bikeNews: 42,
    route: 21,
    spot: 21,
    pendingReview: 3,
    errors: 2,
    nextWeekSuggestion: '春のツーリングシーズン開幕。ルートを優先配信することを提案します。',
  }, '2026-W14');

  console.log('\n✅ 全通知送信完了');
  console.log('各Discordチャンネルを確認してください。');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
main();
