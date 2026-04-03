// utils/discord.js
// Discord通知ユーティリティ - 宇宙世紀キャラクター版

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
export async function sendDiscord(channelKey, message, username = null, avatarUrl = null) {
  const channelId = CHANNELS[channelKey];
  if (!channelId || !BOT_TOKEN) return;

  try {
    const body = { content: message };
    if (username) body.username = username;
    if (avatarUrl) body.avatar_url = avatarUrl;

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${BOT_TOKEN}`,
      },
      body: JSON.stringify(body),
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
// キャラクター定義
// ============================================
const CHARS = {
  giren: { name: 'ギレン・ザビ【参謀】', icon: '🎖️' },
  bright: { name: 'ブライト・ノア【艦長】', icon: '⚓' },
  astonage: { name: 'アストナージ・メドッソ【整備士】', icon: '🔧' },
  bask: { name: 'バスク・オム【監視AG】', icon: '👁️' },
  ma_kube: { name: 'マ・クベ【収集部隊長】', icon: '🏺' },
  haman: { name: 'ハマーン・カーン【生成部隊長】', icon: '👑' },
  scirocco: { name: 'パプティマス・シロッコ【品質部隊長】', icon: '🌪️' },
  kai: { name: 'カイ・シデン【rss_collector】', icon: '📡' },
  aina: { name: 'アイナ・サハリン【route_collector】', icon: '🗺️' },
  gato: { name: 'アナベル・ガトー【spot_collector】', icon: '💥' },
  amuro: { name: 'アムロ・レイ【news_writer】', icon: '⚡' },
  shiro: { name: 'シロー・アマダ【route_writer】', icon: '🏔️' },
  kou: { name: 'コウ・ウラキ【spot_writer】', icon: '🌄' },
  char: { name: 'シャア・アズナブル【quality_checker】', icon: '🔴' },
  mirai: { name: 'ミライ・ヤシマ【scheduler】', icon: '🧭' },
};

function fmt(char, message) {
  return `${char.icon} **${char.name}**\n${message}`;
}

// ============================================
// 起動・停止
// ============================================
export async function notifyStartup() {
  await sendDiscord('status', fmt(CHARS.giren,
    `諸君、RIDOニュースエージェントの作戦を開始する。\n全パイロット、配置につけ。勝利は我らの中にある！`
  ));
}

export async function notifyShutdown() {
  await sendDiscord('status', fmt(CHARS.giren,
    `作戦を終了する。諸君の働きに敬意を表する。`
  ));
}

// ============================================
// パイプライン通知
// ============================================
export async function notifyPipelineStart(hour) {
  await sendDiscord('status', fmt(CHARS.bright,
    `${hour}時のサイクルを開始する。各員、持ち場につけ。弾幕を張るぞ、一記事も漏らすな！`
  ));
}

export async function notifyPipelineComplete(hour, stats) {
  const lines = [
    `${hour}時のサイクル完了だ。報告する。`,
    `📡 収集: ${stats.rss?.passed || 0}件`,
    `⚡ 記事生成: ${stats.news?.passed || 0}件`,
    `🔴 品質承認: ${stats.quality?.approved || 0}件 / 審査待ち: ${stats.quality?.pendingReview || 0}件`,
    `🧭 配信: ${stats.scheduler?.published || 0}件`,
  ];
  if ((stats.quality?.pendingReview || 0) > 0) {
    lines.push(`\n承認待ちがある。確認してくれ。`);
  }
  await sendDiscord('status', fmt(CHARS.bright, lines.join('\n')));
}

// ============================================
// パイロット個別報告（#rido-daily）
// ============================================
export async function reportRssCollector(stats) {
  const { passed, fetched, duplicate } = stats;
  await sendDiscord('daily', fmt(CHARS.kai,
    `おーおー、今日も回ってきたぞ。\n${fetched}件チェックして、${passed}件確保。重複${duplicate}件は除いてある。\n……ま、これだけ拾えりゃ上出来だろ。`
  ));
}

export async function reportRouteCollector(stats) {
  const { stored, fetched, fallback } = stats;
  await sendDiscord('daily', fmt(CHARS.aina,
    `ルートデータ、${fetched}件から${stored}件を選びました。${fallback > 0 ? `\nフォールバック${fallback}件含みます。` : ''}\nシローに渡します。……きっと、いい記事にしてくれるはずです。`
  ));
}

export async function reportSpotCollector(stats) {
  const { stored, area, fallbackMode } = stats;
  await sendDiscord('daily', fmt(CHARS.gato,
    `ソロモンよ、私は帰ってきた。\n${area}エリア、${stored}件確保した。${fallbackMode ? '\n……フォールバックを余儀なくされたが、任務は完遂した。' : ''}\nコウ・ウラキ、これを記事にできるか？\n貴様の腕を見せてみろ。`
  ));
}

export async function reportNewsWriter(stats) {
  const { passed, rejected } = stats;
  await sendDiscord('daily', fmt(CHARS.amuro,
    `見える……トレンドが見えるよ……！\n${passed}本書きました。修正プロンプトなんていりません。\n${rejected > 0 ? `${rejected}本はhookで弾きました。` : '全本通過です。'}\nシャアさんに回します。`
  ));
}

export async function reportRouteWriter(stats) {
  const { passed, rejected } = stats;
  await sendDiscord('daily', fmt(CHARS.shiro,
    `ルート記事、${passed}本書き上げました。${rejected > 0 ? `${rejected}本は弾きました。` : ''}\nアイナのデータは正確で、書きやすかったです。\n……俺は生き延びて、このルートの魅力を伝える！`
  ));
}

export async function reportSpotWriter(stats) {
  const { passed, area } = stats;
  await sendDiscord('daily', fmt(CHARS.kou,
    `${area}エリアのスポット記事、${passed}本書き上げました！\n……認めたくないですけど、ガトー大尉のデータはいいスポットばかりでした。\n次は僕が先に見つけます。絶対に。`
  ));
}

export async function reportQualityChecker(stats) {
  const { approved, autoFixed, pendingReview } = stats;
  const lines = [
    `認めたくないものだな……プロンプトの過ちゆえの、粗削りな記事というものを。`,
    `${approved}本通過。${autoFixed > 0 ? `${autoFixed}本は自動修正した。` : ''}`,
  ];
  if (pendingReview > 0) {
    lines.push(`${pendingReview}本は差し戻す。アムロ、書き直せ。`);
  } else {
    lines.push(`当たらなければどうということはない。全本通過だ。`);
  }
  await sendDiscord('daily', fmt(CHARS.char, lines.join('\n')));
}

export async function reportScheduler(stats) {
  const { published, skipped, todayArea } = stats;
  await sendDiscord('daily', fmt(CHARS.mirai,
    `配信の気流を読みました。\n${todayArea}エリア向け、${published}本を予定通り配信しました。${skipped > 0 ? `${skipped}本はバランス調整でスキップ。` : ''}\n……スケジュール通り、最短航路でサーバーへ届けました。`
  ));
}

// ============================================
// アラート通知
// ============================================
export async function notifyLayer1(title, reason, sourceUrl = null) {
  const lines = [
    `ハマーンの生成した記事か。……いや、これは通せん。`,
    `タイトル: ${title?.slice(0, 40)}`,
    `理由: ${reason}`,
  ];
  if (sourceUrl) lines.push(`ソース: ${sourceUrl}`);
  lines.push(`\n承認待ちキューへ移した。確認してくれたまえ。`);
  await sendDiscord('alert', fmt(CHARS.scirocco, lines.join('\n')));
}

export async function notifyAgentError(agent, errorMsg) {
  await sendDiscord('alert', fmt(CHARS.bask,
    `システムに異常発生。${agent}が落ちた。\n${errorMsg?.slice(0, 200)}\n……落ちはせん、一サーバーたりともな！`
  ));
}

export async function notifyFallback(agent, reason) {
  await sendDiscord('alert', fmt(CHARS.bask,
    `フォールバック発生。[${agent}]\n${reason}\n死活監視の結果、対応済みだ。`
  ));
}

// ============================================
// 週次・日次レポート
// ============================================
export async function notifyDailyReport(stats) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = `${jst.getUTCMonth()+1}/${jst.getUTCDate()}`;

  const lines = [
    `${dateStr}の作戦、終了だ。報告する。`,
    ``,
    `📡 収集: ${stats.collected || 0}件`,
    `⚡ 生成: ${stats.generated || 0}件`,
    `✅ 自動公開: ${stats.approved || 0}件`,
    `⏳ 承認待ち: ${stats.pendingReview || 0}件`,
    `❌ エラー: ${stats.errors || 0}件`,
  ];
  if (stats.pendingReview > 0) {
    lines.push(`\n承認待ち記事を確認してくれ。勝利は我らの中にある！`);
  }
  await sendDiscord('daily', fmt(CHARS.giren, lines.join('\n')));
}

export async function notifyWeeklyReport(stats, briefingWeek) {
  const lines = [
    `${briefingWeek}の作戦報告だ。諸君、よく聞け。`,
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
    lines.push(`\n来週の提案: ${stats.nextWeekSuggestion}`);
    lines.push(`→ 承認 / 却下 / 修正を求む。`);
  }
  lines.push(`\nあえて言おう、この配信数では物足りないと！ 来週こそ真の勝利を掴め！`);
  await sendDiscord('briefing', fmt(CHARS.giren, lines.join('\n')));
}

// ============================================
// 週次ブリーフィング配布
// ============================================
export async function notifyBriefingDistributed(briefingWeek, message) {
  await sendDiscord('briefing', fmt(CHARS.giren,
    `諸君、${briefingWeek}のブリーフィングを発令する。\n\n${message}\n\n立てよ、エージェント！ 勝利は我らの中にある！`
  ));
}

// ============================================
// skills更新通知
// ============================================
export async function notifySkillsUpdated(file, problem) {
  await sendDiscord('status', fmt(CHARS.astonage,
    `${file}の修正、完了だ。\n問題: ${problem}\nそんなにいじくり回すなよ、繊細なんだ。……次から気をつけろよな！`
  ));
}
