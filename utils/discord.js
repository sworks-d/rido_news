// utils/discord.js
// Discord通知の共通ユーティリティ

import { config } from 'dotenv';
config();

const CHANNELS = {
  alert: process.env.DISCORD_CHANNEL_ALERT,
  briefing: process.env.DISCORD_CHANNEL_BRIEFING,
  daily: process.env.DISCORD_CHANNEL_DAILY,
  status: process.env.DISCORD_CHANNEL_STATUS,
};

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// ============================================
// 基本送信
// ============================================
export async function sendDiscord(channelKey, message) {
  const channelId = CHANNELS[channelKey];
  if (!channelId || !BOT_TOKEN) return;

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${BOT_TOKEN}`,
      },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Discord] 送信失敗 ${channelKey}:`, err);
    }
  } catch (err) {
    console.error(`[Discord] エラー ${channelKey}:`, err.message);
  }
}

// ============================================
// パイプライン通知
// ============================================
export async function notifyPipelineStart(hour) {
  await sendDiscord('status',
    `⚙️ **パイプライン開始** ${hour}時のサイクルを開始します。`
  );
}

export async function notifyPipelineComplete(hour, stats) {
  const lines = [
    `✅ **パイプライン完了** ${hour}時のサイクルが完了しました。`,
    `📰 バイクニュース収集: ${stats.rss?.passed || 0}件`,
    `✍️ 記事生成: ${stats.news?.passed || 0}件`,
    `🛡️ 品質承認: ${stats.quality?.approved || 0}件 / 審査待ち: ${stats.quality?.pendingReview || 0}件`,
    `📡 配信: ${stats.scheduler?.published || 0}件`,
  ];
  await sendDiscord('status', lines.join('\n'));
}

// ============================================
// アラート通知
// ============================================
export async function notifyAlert(agent, issue, detail = null) {
  const lines = [
    `🚨 **要確認** [${agent}]`,
    `問題: ${issue}`,
  ];
  if (detail) lines.push(`詳細: ${detail}`);
  await sendDiscord('alert', lines.join('\n'));
}

// Layer1引っかかり
export async function notifyLayer1(title, reason, sourceUrl = null) {
  const lines = [
    `⚠️ **品質アラート** Layer1引っかかり`,
    `タイトル: ${title?.slice(0, 40)}`,
    `理由: ${reason}`,
  ];
  if (sourceUrl) lines.push(`ソース: ${sourceUrl}`);
  lines.push(`→ 承認 / 却下はSupabaseのnews_articlesで対応`);
  await sendDiscord('alert', lines.join('\n'));
}

// エージェントエラー
export async function notifyAgentError(agent, errorMsg) {
  await sendDiscord('alert',
    `❌ **エージェントエラー** [${agent}]\n${errorMsg?.slice(0, 200)}`
  );
}

// フォールバック発生
export async function notifyFallback(agent, reason) {
  await sendDiscord('alert',
    `⚡ **フォールバック発生** [${agent}]\n${reason}`
  );
}

// ============================================
// 日次レポート
// ============================================
export async function notifyDailyReport(stats) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = `${jst.getUTCMonth()+1}/${jst.getUTCDate()}`;

  const lines = [
    `📊 **日次レポート** ${dateStr}`,
    ``,
    `📰 収集: ${stats.collected || 0}件`,
    `✍️ 生成: ${stats.generated || 0}件`,
    `✅ 自動公開: ${stats.approved || 0}件`,
    `⏳ 承認待ち: ${stats.pendingReview || 0}件`,
    `❌ エラー: ${stats.errors || 0}件`,
  ];

  if (stats.pendingReview > 0) {
    lines.push(`\n→ 承認待ち記事をSupabaseで確認してください`);
  }

  await sendDiscord('daily', lines.join('\n'));
}

// ============================================
// 週次レポート
// ============================================
export async function notifyWeeklyReport(stats, briefingWeek) {
  const lines = [
    `📈 **週次レポート** ${briefingWeek}`,
    ``,
    `総配信数: ${stats.totalPublished || 0}件`,
    `バイクニュース: ${stats.bikeNews || 0}件`,
    `ルート: ${stats.route || 0}件`,
    `スポット: ${stats.spot || 0}件`,
    ``,
    `承認待ち（未処理）: ${stats.pendingReview || 0}件`,
    `エラー合計: ${stats.errors || 0}件`,
  ];

  if (stats.nextWeekSuggestion) {
    lines.push(`\n💡 来週の提案: ${stats.nextWeekSuggestion}`);
    lines.push(`→ 承認 / 却下 / 修正`);
  }

  await sendDiscord('briefing', lines.join('\n'));
}

// ============================================
// 起動・停止通知
// ============================================
export async function notifyStartup() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timeStr = `${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2,'0')}`;
  await sendDiscord('status',
    `🚀 **RIDO News Agent 起動** ${timeStr}\n全パイロット待機中。`
  );
}

export async function notifyShutdown() {
  await sendDiscord('status', `🛑 **RIDO News Agent 停止**`);
}
