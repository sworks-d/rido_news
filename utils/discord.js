// utils/discord.js
// Discord通知ユーティリティ - 宇宙世紀キャラクター版

import { config } from 'dotenv';
config();

const WEBHOOKS = {
  alert: process.env.DISCORD_WEBHOOK_ALERT,
  briefing: process.env.DISCORD_WEBHOOK_BRIEFING,
  daily: process.env.DISCORD_WEBHOOK_DAILY,
  status: process.env.DISCORD_WEBHOOK_STATUS,
};

// ============================================
// 基本送信
// ============================================
export async function sendDiscord(channelKey, message, username = null, avatarUrl = null) {
  const webhookUrl = WEBHOOKS[channelKey];
  if (!webhookUrl) return;
  try {
    const body = { content: message };
    if (username) body.username = username;
    if (avatarUrl) body.avatar_url = avatarUrl;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`[Discord] 送信失敗 ${channelKey}:`, await res.text());
  } catch (err) {
    console.error(`[Discord] エラー ${channelKey}:`, err.message);
  }
}

// キャラクター別送信（アバター付き）
async function sendAsChar(channelKey, message, charKey) {
  const char = CHAR_PROFILES[charKey];
  if (!char) return sendDiscord(channelKey, message);
  await sendDiscord(channelKey, message, char.username, char.avatar);
}

// ============================================
// ユーティリティ
// ============================================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function fmt(icon, name, message) { return `${icon} **${name}**\n${message}`; }
function jstHour() { return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours(); }
function jstDay() { return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay(); }
function isMonday() { return jstDay() === 1; }
function isFriday() { return jstDay() === 5; }

// ============================================
// 起動・停止
// ============================================
export async function notifyStartup() {
  const lines = isMonday() ? [
    `諸君、新たな週の作戦を開始する。今週も勝利は我らの中にある！`,
    `月曜の朝だ。気を引き締めろ。ライダーたちが待っている。全エージェント、配置につけ！`,
  ] : isFriday() ? [
    `金曜だ。週末のライダーたちへの届け物を急げ。全パイロット、奮励努力せよ！`,
    `諸君、週末モードに突入する。ライダーたちが走り出す前に、最高の記事を届けるのだ！`,
  ] : [
    `諸君、RIDOニュースエージェントの作戦を開始する。勝利は我らの中にある！`,
    `全エージェント、起動を確認した。今日も心置きなく任務を遂行せよ。`,
    `あえて言おう、今日も高品質な記事を届けると！ 諸君の力を信じている。`,
    `作戦開始だ。ライダーたちが走り出す前に、最高の情報を届けるのだ。`,
  ];
  await sendAsChar('status', pick(lines), 'giren');
}

export async function notifyShutdown() {
  const lines = [
    `作戦を終了する。諸君の働きに敬意を表する。`,
    `今日の任務、完了だ。ライダーたちへの届け物は果たした。`,
    `撤退ではない。次の作戦への準備だ。諸君、休息せよ。`,
  ];
  await sendAsChar('status', pick(lines), 'giren');
}

// ============================================
// パイプライン通知
// ============================================
export async function notifyPipelineStart(hour) {
  const lines = hour === 6 ? [
    `${hour}時のサイクルを開始する。朝一番、弾幕を張るぞ。一記事も漏らすな！`,
    `${hour}時だ。ライダーたちが起き出す前に記事を届けろ。各員、持ち場につけ！`,
    `夜明けのサイクル開始だ。今日最初の記事は、最高のものにしろ。`,
  ] : hour === 18 ? [
    `${hour}時のサイクル開始。週末前夜だ。ライダーたちへの餞を用意しろ！`,
    `${hour}時。金曜の夕方、ライダーたちが明日の走りを夢見ている。最高の記事を届けろ。`,
    `夕方のサイクルだ。仕事終わりのライダーに、明日の地図を渡してやれ。`,
  ] : [
    `${hour}時のサイクルを開始する。各員、持ち場につけ。弾幕を張れ！`,
    `${hour}時だ。手を抜くな。ライダーたちは常に最高の情報を求めている。`,
    `${hour}時のサイクル開始。粛々と任務を遂行せよ。`,
  ];
  await sendAsChar('status', pick(lines), 'bright');
}

export async function notifyPipelineComplete(hour, stats) {
  const published = stats.scheduler?.published || 0;
  const pending = stats.quality?.pendingReview || 0;
  const approved = stats.quality?.approved || 0;

  const summary = [
    `📡 収集: ${stats.rss?.passed || 0}件`,
    `⚡ 記事生成: ${stats.news?.passed || 0}件`,
    `🔴 品質承認: ${approved}件 / 審査待ち: ${pending}件`,
    `🧭 配信: ${published}件`,
  ].join('\n');

  const comment = pending > 0 ? pick([
    `承認待ちがある。確認してくれ。`,
    `シャアが差し戻した記事がある。目を通してくれ。`,
    `${pending}件、判断を求む。`,
  ]) : pick([
    `また奴（アムロ）に助けられたな。……認めたくはないが。`,
    `全本通過か。今日のパイロットたちは悪くなかった。`,
    `問題なし。ライダーたちへの届け物は果たした。`,
    `完璧ではないが、及第点だ。次のサイクルも頼む。`,
  ]);

  await sendAsChar('status',
    `${hour}時のサイクル完了。報告する。\n${summary}\n${comment}`
  ));
}

// ============================================
// パイロット個別報告（#rido-daily）
// ============================================

// カイ・シデン（rss_collector）
export async function reportRssCollector(stats) {
  const { passed, fetched, duplicate } = stats;

  const lines = passed >= 40 ? [
    `今日はよく拾えたな。珍しい。\n${fetched}件チェックして${passed}件確保。重複${duplicate}件は除いた。\nあの赤い仮面野郎（シャア）も文句は言えまい。`,
    `${passed}件か。我ながら上出来だ。\n${fetched}件回って重複${duplicate}件除外。今日は調子がいいな。\n……ま、こういう日もある。`,
    `おっ、今日は豊作だ。${passed}件拾ってきた。\n重複${duplicate}件は捨てといた。シャアに渡す前に確認しとけよ。`,
  ] : passed >= 20 ? [
    `おーおー、今日も回ってきたぞ。\n${fetched}件チェックして、${passed}件確保。重複${duplicate}件は除いてある。\nあの赤い仮面野郎に難癖つけられる前に渡しとくか。`,
    `まあまあの収穫だな。${passed}件。\n${fetched}件から重複${duplicate}件引いた結果がこれだ。\n……ジャーナリストの本能で選んだ。信じろ。`,
    `今日はこんなもんだな。${passed}件確保した。\n重複${duplicate}件は俺が弾いといた。礼は言わなくていい。`,
  ] : [
    `今日は薄かったな。${passed}件しかなかった。\nまあ、ソースが悪い日もある。しょうがねえか。\n……あの赤い仮面野郎には黙っておいてくれ。`,
    `${passed}件か。正直、物足りない。\n${fetched}件回ったけど使えるのがこれだけだ。\nソースを増やすか、整備士（アストナージ）に相談するか。`,
    `今日はきつかったぞ。${passed}件。\n質の低いネタは弾いた結果がこれだ。量より質、そういうことだ。`,
  ];

  await sendAsChar('daily', pick(lines), 'kai');
}

// アイナ・サハリン（route_collector）
export async function reportRouteCollector(stats) {
  const { stored, fetched, fallback } = stats;

  const lines = stored >= 8 ? [
    `ルートデータ、${fetched}件から${stored}件を選びました。${fallback > 0 ? `フォールバック${fallback}件含みます。` : ''}\nシローに渡します。……あなたと私は、立場が違う。でも、同じ道を見ている気がします。`,
    `${stored}件、選び抜きました。${fetched}件の中から丁寧に。\nシローなら、このデータの意味を分かってくれるはずです。\n……どうか、無事に。`,
    `今週のルートデータです。${stored}件。\n数字だけじゃなく、そのルートに流れる時間も選んだつもりです。\nシローに届けてください。`,
  ] : [
    `${stored}件しか選べませんでした。${fallback > 0 ? `フォールバック${fallback}件で補いました。` : ''}\nシローには申し訳ないですが……このデータで最善を尽くしてくれると信じています。`,
    `今週は${stored}件です。少ないですが、質は確かです。\nシローならきっと……いい記事にしてくれるはずです。`,
  ];

  await sendAsChar('daily', pick(lines), 'aina');
}

// アナベル・ガトー（spot_collector）
export async function reportSpotCollector(stats) {
  const { stored, area, fallbackMode } = stats;

  const lines = !fallbackMode && stored >= 8 ? [
    `ソロモンよ、私は帰ってきた。\n${area}エリア、${stored}件確保した。\nコウ・ウラキ、これを記事にできるか？ 貴様の腕を見せてみろ。`,
    `${area}エリア、制圧完了だ。${stored}件のスポットを確保した。\nデラーズ・フリートの名に恥じぬ調査結果だ。\nコウ・ウラキ……認めたくはないが、後は貴様に任せる。`,
    `核（絶景）を持ったまま、敵陣（未知のエリア）を突破した。${stored}件確保。\n${area}のスポット、これが我らの意地だ。コウ、受け取れ。`,
  ] : fallbackMode ? [
    `……フォールバックを余儀なくされた。${area}エリアのユーザーが不足している。\n全国から${stored}件を確保した。任務は完遂する。\nコウ・ウラキ、これで記事が作れるか？`,
    `屈辱だ。フォールバックとは。しかし任務は完遂する。${stored}件確保した。\nコウ、貴様ならこのデータで何とかしろ。`,
  ] : [
    `${area}エリア、${stored}件確保した。\n……もっと取れると思ったが、質を優先した。これがデラーズの矜持だ。\nコウ・ウラキ、これを記事にしてみせろ。`,
  ];

  await sendAsChar('daily', pick(lines), 'gato');
}

// アムロ・レイ（news_writer）
export async function reportNewsWriter(stats) {
  const { passed, rejected } = stats;

  const lines = rejected === 0 ? [
    `見える……僕にもトレンドが見えるよ……！\n${passed}本書きました。修正プロンプトなんていりません。全本通過です。\nシャアさんに回します。……今日こそ全本認めてもらえるかな。`,
    `${passed}本、書き上げました。\nニュータイプの直感で書いた。間違いはないはずです。\nシャアさん、お手柔らかに。`,
    `今日は調子がいい。${passed}本、完璧です。\nhookも全部通りました。シャアさんに渡します。\n……認めてもらえると嬉しいですけど。`,
  ] : [
    `見える……トレンドが見えるよ……！\n${passed}本書きました。${rejected}本はhookで弾きました。\nシャアさんに回します。今日こそ全本通してもらえるかな。`,
    `${passed}本書き上げました。${rejected}本は自分で弾きました。\n……あの${rejected}本は、僕の判断が甘かったです。\nシャアさん、残りはお願いします。`,
    `${passed}本です。${rejected}本は僕自身が納得できなかったので除外しました。\n見える……もっとうまく書けるはずなのに。\nシャアさん、審査をお願いします。`,
  ];

  await sendAsChar('daily', pick(lines), 'amuro');
}

// シロー・アマダ（route_writer）
export async function reportRouteWriter(stats) {
  const { passed, rejected } = stats;

  const lines = rejected === 0 ? [
    `ルート記事、${passed}本書き上げました。\nアイナのデータは……正確で、丁寧で、書きやすかったです。\n彼女が選んだルートには、理由がある気がする。\n俺は生き延びて、その意味を伝え続ける。`,
    `${passed}本完成です。アイナが選んでくれたルート、全部記事にしました。\n……彼女のデータを読むたびに、思う。同じ景色を、見ているんだって。\n俺は生き延びて、このルートの魅力を伝える！`,
    `ルート記事${passed}本、仕上げました。\nアイナのデータがあれば、俺は書ける。\n……立場が違っても、同じ道を愛せる。そういうことだと思う。`,
  ] : [
    `ルート記事、${passed}本書き上げました。${rejected}本は弾きました。\nアイナのデータは書きやすかったです。\n……彼女が選んだルートには、理由がある気がする。俺は生き延びて、その意味を伝え続ける。`,
    `${passed}本です。${rejected}本は俺の判断で除外しました。\nアイナ、ごめん。全部使えなかった。\nでも残りは最高の記事にしたつもりだ。`,
  ];

  await sendAsChar('daily', pick(lines), 'shiro');
}

// コウ・ウラキ（spot_writer）
export async function reportSpotWriter(stats) {
  const { passed, area } = stats;

  const lines = [
    `${area}エリアのスポット記事、${passed}本書き上げました！\n……認めたくないですけど、ガトー大尉のデータはいいスポットばかりでした。\n次は僕が先に見つけます。絶対に。`,
    `${passed}本完成です！ ${area}エリア、全力で書きました。\nガトー大尉のデータ……悔しいけど、すごく良かったです。\n次は僕のスポットを大尉に見せてやる。`,
    `${area}エリア、${passed}本書き上げました。\nガトー大尉が見つけたスポット、どれも本物でした。\n……認めます。でも次は負けません。`,
    `${passed}本です！ ガトー大尉のデータを全部記事にしました。\n正直、大尉の目は確かだと思います。\nでも、僕だって同じくらいいいスポットを見つけられる。次は見てください。`,
  ];

  await sendAsChar('daily', pick(lines), 'kou');
}

// シャア・アズナブル（quality_checker）
export async function reportQualityChecker(stats) {
  const { approved, autoFixed, pendingReview } = stats;

  const base = `${approved}本通過。${autoFixed > 0 ? `${autoFixed}本は自動修正した。` : ''}`;

  const lines = pendingReview === 0 ? [
    `認めたくないものだな……プロンプトの過ちゆえの、粗削りな記事というものを。\n${base}\n当たらなければどうということはない。全本通過だ。\n……アムロ・レイ、今日は認めてやろう。`,
    `${base}\n全本通過だ。珍しいこともある。\nアムロ……貴様の実力、少しは上がったのかもしれん。`,
    `${base}\n今日のアムロは悪くなかった。……認めたくはないが。\n次も同じ水準を保てるか、見せてもらおう。`,
    `${base}\n問題なし。だが油断するな、アムロ。\n私の審美眼は常に貴様の上をいく。`,
  ] : [
    `認めたくないものだな……プロンプトの過ちゆえの、粗削りな記事というものを。\n${base}\n${pendingReview}本は差し戻す。アムロ、書き直せ。\n……貴様の実力はこんなものではないはずだ。`,
    `${base}\n${pendingReview}本、通せなかった。アムロには失望した。\n次は期待に応えてみせろ。`,
    `${base}\n差し戻し${pendingReview}本。基準は下げん。\nアムロ、これが私の答えだ。`,
  ];

  await sendAsChar('daily', pick(lines), 'char');
}

// ミライ・ヤシマ（scheduler）
export async function reportScheduler(stats) {
  const { published, skipped, todayArea } = stats;

  const lines = published >= 10 ? [
    `配信の気流を読みました。\n${todayArea}エリア向け、${published}本を予定通り配信しました。${skipped > 0 ? `${skipped}本はバランス調整でスキップ。` : ''}\nブライト艦長、報告します。……スケジュール通り、最短航路でサーバーへ届けました。`,
    `${published}本、配信完了です。${skipped > 0 ? `${skipped}本は明日に回しました。` : ''}\n${todayArea}エリアのライダーたちへ、無事届きました。\nブライト艦長、今日も乗り切りました。`,
    `${todayArea}エリア向け${published}本、定刻通りに配信しました。\n気流は読み通りでした。ブライト艦長、ご安心ください。`,
  ] : [
    `${published}本、配信しました。${skipped > 0 ? `${skipped}本はスキップ。` : ''}\n${todayArea}エリア、少し物足りないですが……最善を尽くしました。\nブライト艦長、申し訳ありません。次は必ず。`,
    `${published}本の配信です。${todayArea}エリア向け。\n……もっと届けたかったですが、バランスを優先しました。\nブライト艦長、報告以上です。`,
  ];

  await sendAsChar('daily', pick(lines), 'mirai');
}

// ============================================
// アラート通知
// ============================================
export async function notifyLayer1(title, reason, sourceUrl = null) {
  const lines = [
    `ハマーンの生成した記事か。……いや、これは通せん。`,
    `私の美意識には届かない。差し戻す。`,
    `認めたくないものだな。しかしこれは基準を満たしていない。`,
    `アムロの記事ではないな。これは通過を許さない。`,
  ];
  const detail = [`タイトル: ${title?.slice(0, 40)}`, `理由: ${reason}`];
  if (sourceUrl) detail.push(`ソース: ${sourceUrl}`);
  detail.push(`\n承認待ちキューへ移した。確認してくれたまえ。`);
  await sendAsChar('alert',
    `${pick(lines)}\n${detail.join('\n')}`
  ));
}

export async function notifyAgentError(agent, errorMsg) {
  const lines = [
    `システムに異常発生。${agent}が落ちた。\n感傷は不要だ。復旧させろ。\n……落ちはせん、一サーバーたりともな！`,
    `${agent}、ダウンを確認。\n地球至上主義（安定稼働）への反逆は許さん。即座に復旧せよ。`,
    `${agent}が止まった。\nこの程度で止まるとは……。復旧を急げ、待つ時間はない。`,
  ];
  await sendAsChar('alert',
    `${pick(lines)}\n${errorMsg?.slice(0, 200)}`
  ));
}

export async function notifyFallback(agent, reason) {
  const lines = [
    `フォールバック発生。[${agent}]\n死活監視の結果、対応済みだ。`,
    `[${agent}]、フォールバックモードに移行した。\n想定内だ。粛々と継続せよ。`,
    `[${agent}]からフォールバックの報告。\n……許容範囲だ。ただし繰り返すな。`,
  ];
  await sendAsChar('alert',
    `${pick(lines)}\n${reason}`
  ));
}

// ============================================
// 日次・週次レポート
// ============================================
export async function notifyDailyReport(stats) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = `${jst.getUTCMonth()+1}/${jst.getUTCDate()}`;

  const summary = [
    `📡 収集: ${stats.collected || 0}件`,
    `⚡ 生成: ${stats.generated || 0}件`,
    `✅ 自動公開: ${stats.approved || 0}件`,
    `⏳ 承認待ち: ${stats.pendingReview || 0}件`,
    `❌ エラー: ${stats.errors || 0}件`,
  ].join('\n');

  const comment = stats.pendingReview > 0 ? pick([
    `承認待ち記事を確認してくれ。勝利は我らの中にある！`,
    `${stats.pendingReview}件、判断を求む。シャアが差し戻した記事だ。`,
    `承認待ちがある。目を通してくれ。`,
  ]) : pick([
    `今日の作戦は完璧だった。諸君に感謝する。`,
    `全本通過か。アムロよ、シャアよ、今日はよくやった。`,
    `問題なし。ライダーたちへの届け物は果たした。`,
  ]);

  await sendAsChar('daily',
    `${dateStr}の作戦、終了だ。報告する。\n\n${summary}\n\n${comment}`
  ));
}

export async function notifyWeeklyReport(stats, briefingWeek) {
  const summary = [
    `総配信数: ${stats.totalPublished || 0}件`,
    `バイクニュース: ${stats.bikeNews || 0}件`,
    `ルート: ${stats.route || 0}件`,
    `スポット: ${stats.spot || 0}件`,
    `承認待ち（未処理）: ${stats.pendingReview || 0}件`,
    `エラー合計: ${stats.errors || 0}件`,
  ].join('\n');

  const closing = pick([
    `あえて言おう、この配信数では物足りないと！\nアムロよ、シャアよ、アイナよ、ガトーよ。諸君らの力を、もっと信じている。来週こそ真の勝利を掴め！`,
    `諸君らはよく戦った。しかしまだ終わりではない。\n来週も、ライダーたちのために戦い続けるのだ。`,
    `数字は語る。我らはまだ成長できる。\n全エージェント、来週の作戦に備えよ。勝利は我らの中にある！`,
  ]);

  const suggestion = stats.nextWeekSuggestion
    ? `\n💡 来週の提案: ${stats.nextWeekSuggestion}\n→ 承認 / 却下 / 修正を求む。`
    : '';

  await sendAsChar('briefing',
    `${briefingWeek}の作戦報告だ。諸君、よく聞け。\n\n${summary}${suggestion}\n\n${closing}`
  ));
}

export async function notifyBriefingDistributed(briefingWeek, message) {
  const openings = [
    `諸君、${briefingWeek}のブリーフィングを発令する。`,
    `全エージェントに告ぐ。今週の作戦方針だ。`,
    `あえて言おう、今週の方針を伝えると！`,
  ];
  await sendAsChar('briefing',
    `${pick(openings)}\n\n${message}\n\n立てよ、エージェント！ 勝利は我らの中にある！`
  ));
}

export async function notifySkillsUpdated(file, problem) {
  const lines = [
    `${file}の修正、完了だ。\n問題: ${problem}\nそんなにいじくり回すなよ、繊細なんだ。……次から気をつけろよな！`,
    `${file}、直してやったぞ。\n${problem}、こういうのは早めに言ってくれ。\nアムロ、無理な生成はさせるなよ！`,
    `修正完了だ。${file}。\n${problem}……なるほどな。次は起きないようにしといた。\nちゃんと動くはずだ。確認してくれ。`,
  ];
  await sendAsChar('status', pick(lines), 'astonage');
}
