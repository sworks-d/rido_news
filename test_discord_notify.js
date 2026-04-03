// test_discord_notify.js
// 宇宙世紀キャラクター版 Discord通知テスト
// 実行方法: node test_discord_notify.js

import {
  notifyStartup, notifyShutdown,
  notifyPipelineStart, notifyPipelineComplete,
  notifyLayer1, notifyAgentError, notifyFallback,
  notifyDailyReport, notifyWeeklyReport,
  reportRssCollector, reportRouteCollector, reportSpotCollector,
  reportNewsWriter, reportRouteWriter, reportSpotWriter,
  reportQualityChecker, reportScheduler,
  notifySkillsUpdated,
} from './utils/discord.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== 宇宙世紀 Discord通知テスト開始 ===\n');

  console.log('[1] ギレン：起動宣言 → #rido-status');
  await notifyStartup();
  await sleep(800);

  console.log('[2] ブライト：パイプライン開始 → #rido-status');
  await notifyPipelineStart(6);
  await sleep(800);

  console.log('[3] カイ：RSS収集報告 → #rido-daily');
  await reportRssCollector({ passed: 35, fetched: 120, duplicate: 18 });
  await sleep(800);

  console.log('[4] アイナ：ルート集計報告 → #rido-daily');
  await reportRouteCollector({ stored: 8, fetched: 45, fallback: 2 });
  await sleep(800);

  console.log('[5] ガトー：スポット調査報告 → #rido-daily');
  await reportSpotCollector({ stored: 10, area: '東海', fallbackMode: false });
  await sleep(800);

  console.log('[6] アムロ：記事生成報告 → #rido-daily');
  await reportNewsWriter({ passed: 12, rejected: 1 });
  await sleep(800);

  console.log('[7] シロー：ルート記事報告 → #rido-daily');
  await reportRouteWriter({ passed: 1, rejected: 0 });
  await sleep(800);

  console.log('[8] コウ：スポット記事報告 → #rido-daily');
  await reportSpotWriter({ passed: 1, area: '東海' });
  await sleep(800);

  console.log('[9] シャア：品質判定報告 → #rido-daily');
  await reportQualityChecker({ approved: 11, autoFixed: 3, pendingReview: 2 });
  await sleep(800);

  console.log('[10] ミライ：配信管制報告 → #rido-daily');
  await reportScheduler({ published: 11, skipped: 2, todayArea: '東海' });
  await sleep(800);

  console.log('[11] ブライト：パイプライン完了 → #rido-status');
  await notifyPipelineComplete(6, {
    rss: { passed: 35 },
    news: { passed: 12 },
    quality: { approved: 11, pendingReview: 2 },
    scheduler: { published: 11 },
  });
  await sleep(800);

  console.log('[12] シロッコ：Layer1アラート → #rido-alert');
  await notifyLayer1('新型Ducati発表', '著作権リスク: summary/body比率超過 (22%)', 'https://www.totalmotorcycle.com/xxx');
  await sleep(800);

  console.log('[13] バスク：フォールバック通知 → #rido-alert');
  await notifyFallback('spot_collector', '東北エリアのユーザー数が0件 → 全国フォールバックモードで実行');
  await sleep(800);

  console.log('[14] アストナージ：skills更新通知 → #rido-status');
  await notifySkillsUpdated('skills/rido_tone.md', '命令調の誤検知が連続3件発生');
  await sleep(800);

  console.log('[15] ギレン：週次レポート → #rido-briefing');
  await notifyWeeklyReport({
    totalPublished: 84,
    bikeNews: 42,
    route: 21,
    spot: 21,
    pendingReview: 3,
    errors: 2,
    nextWeekSuggestion: '春のツーリングシーズン開幕。ルートを優先配信することを提案する。',
  }, '2026-W14');

  console.log('\n=== 全通知送信完了 ===');
  console.log('各Discordチャンネルを確認してください。');
}

main();
