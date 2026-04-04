// news_writer.js
// news_rawの素材からバイクニュース記事を生成してnews_articlesに格納する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { reportNewsWriter } from '../utils/discord.js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// ブリーフィング取得
// ============================================
async function getBriefing(briefingWeek) {
  const { data } = await supabase
    .from('weekly_briefings')
    .select('*')
    .eq('briefing_week', briefingWeek)
    .single();
  return data;
}

// ============================================
// 素材取得（news_rawからpending状態のbike_newsを取得）
// ============================================
async function fetchRawArticles(briefingWeek) {
  const { data, error } = await supabase
    .from('news_raw')
    .select('*')
    .eq('content_type', 'bike_news')
    .eq('status', 'pending')
    .eq('briefing_week', briefingWeek)
    .order('trust_score', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

// ============================================
// ジャンル判定
// ============================================
function detectGenre(title, body) {
  const text = `${title} ${body}`.toLowerCase();
  if (/新型|発売|デビュー|価格|受注|ニューモデル|new model|launch|release/.test(text)) return 'new_model';
  if (/道交法|改正|規制|罰則|免許|法律|rule|regulation|law/.test(text)) return 'regulation';
  if (/イベント|モーターショー|展示会|試乗会|event|show|expo/.test(text)) return 'event';
  if (/motogp|wsbk|全日本|レース|gp|race|superbike/.test(text)) return 'motorsports';
  return 'bike_news';
}

// ============================================
// 記事生成（Anthropic API）
// ============================================
async function generateArticle(raw, briefing) {
  const isEnglish = raw.source_lang === 'en';
  const jpNote = raw.jp_relevance === 'low'
    ? '\n\n【重要】この記事は日本未発売・未発表の可能性があります。sectionsの末尾に以下のsectionを必ず追加してください：{"heading":"日本での発売について","body":"この情報は海外向けの発表です。日本での発売・仕様・価格は未確定の場合があります。国内情報が入り次第、改めてお伝えします。","quoted_comment":null}'
    : '';

  const toneGuidance = briefing?.rido_direction?.tone_guidance || 'フラット50% / 俺50%';
  const weekMessage = briefing?.rido_direction?.message || '最新のバイク情報をRIDOトーンで伝える';

  const prompt = `あなたはRIDOというバイクアプリのニュース記事ライターです。

## 今週の方針
${weekMessage}

## トーン設定（${toneGuidance}）
- 断定しない。可能性を示す。
- ランキングしない。優劣をつけない。
- 承認欲求を煽らない。「映える」「バズる」禁止。
- 命令調禁止：「〜してください」→「〜するといい」
- 感嘆符は1記事2個以内
- 締めの定型文禁止：「いかがでしたか？」「ぜひ参考に」等

## 素材
タイトル：${raw.title}
本文：${raw.body?.slice(0, 1500) || ''}
ソース：${raw.source_name}
言語：${isEnglish ? '英語（日本語で自然に生成すること）' : '日本語'}${jpNote}

## 引用元の掲示
sectionsの最後に必ず「引用元」sectionを追加する。
link_typeは"external"・link_idにsource_urlをそのまま入れる。
bodyは「この記事は[ソース名]の記事を元に作成しました。」の形式。

## 出力形式（JSON）
以下のJSONのみ出力。前後にテキスト・コードブロック不要。

{
  "title": "見出し（30字以内）",
  "summary": "概要（100字以内・3行以内）",
  "index": ["ポイント1（15字以内）","ポイント2（15字以内）","ポイント3（15字以内）"],
  "sections": [
    {"heading":"ポイント1","body":"段落テキスト（200字以内）","quoted_comment":null,"link_type":null,"link_id":null},
    {"heading":"ポイント2","body":"段落テキスト（200字以内）","quoted_comment":null,"link_type":null,"link_id":null},
    {"heading":"ポイント3","body":"段落テキスト（200字以内）","quoted_comment":null,"link_type":null,"link_id":null},
    {"heading":"引用元","body":"この記事は[ソース名]の記事を元に作成しました。","quoted_comment":null,"link_type":"external","link_id":"[source_url]"}
  ],
  "tags": ["タグ1","タグ2","タグ3"],
  "tone_score": 4,
  "tone_notes": "修正内容があれば記載"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  const data = await response.json();
  const text = data.content[0]?.text || '';

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error(`JSON parse error: ${text.slice(0, 100)}`);
  }
}

// ============================================
// hookチェック（DB投入前の物理チェック）
// ============================================
function runHooks(article, raw) {
  if (!raw.source_url) return { pass: false, reason: 'hook_1: source_urlがnull' };
  if (article.title?.length > 30) return { pass: false, reason: 'hook_2: titleが30字超' };
  if (article.summary?.length > 250) return { pass: false, reason: 'hook_3: summaryが250字超' };
  if ((article.index?.length || 0) !== (article.sections?.length || 0)) {
    return { pass: false, reason: 'hook_7: index数とsections数が不一致' };
  }
  return { pass: true };
}

// ============================================
// メイン実行
// ============================================
export async function runNewsWriter(briefingWeek) {
  console.log('[news_writer] 開始');

  // status-board更新
  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'news_writer');

  const briefing = await getBriefing(briefingWeek);
  const rawArticles = await fetchRawArticles(briefingWeek);

  console.log(`[news_writer] 素材: ${rawArticles.length}件`);

  let generated = 0;
  let passed = 0;
  let rejected = 0;

  for (const raw of rawArticles) {
    try {
      // 記事生成
      const article = await generateArticle(raw, briefing);

      // hookチェック
      const hook = runHooks(article, raw);
      if (!hook.pass) {
        console.log(`[news_writer] hook失敗: ${hook.reason}`);
        rejected++;
        // raw statusをerrorに
        await supabase.from('news_raw').update({ status: 'error' }).eq('id', raw.id);
        continue;
      }

      // news_articlesに格納
      const genre = detectGenre(raw.title, raw.body || '');
      const { error } = await supabase.from('news_articles').insert({
        raw_id: raw.id,
        source_type: 'external_rss',
        content_type: 'bike_news',
        category: 'bike_news',
        tab: 'bike_news',
        title: article.title,
        summary: article.summary,
        index_items: article.index,
        sections: article.sections,
        navigation: { source_url: raw.source_url, related_route_id: null, related_area: null },
        tags: article.tags,
        genre,
        tone_score: article.tone_score,
        tone_notes: article.tone_notes,
        source_url: raw.source_url,
        source_name: raw.source_name,
        thumbnail_url: raw.thumbnail_url || null,
        layer1_result: 'pending',
        status: 'pending',
        briefing_week: briefingWeek,
      });

      if (error) throw error;

      // rawをdoneに更新
      await supabase.from('news_raw').update({ status: 'done' }).eq('id', raw.id);
      generated++;
      passed++;

      // API負荷軽減のため少し待つ
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`[news_writer] エラー: ${raw.title?.slice(0, 30)}`, err.message);
      rejected++;
      await supabase.from('news_raw').update({ status: 'error' }).eq('id', raw.id);
    }
  }

  // ログ記録
  await supabase.from('agent_runs').insert({
    agent: 'news_writer',
    task: 'article_generation',
    status: 'success',
    input_count: rawArticles.length,
    output_count: passed,
    metadata: { generated, rejected },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  // status-board更新
  await supabase.from('agent_status').update({
    status: 'done',
    last_count: passed,
    note: `生成${generated}件 / 却下${rejected}件`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'news_writer');

  console.log(`[news_writer] 完了: ${passed}件格納 / ${rejected}件却下`);
  await reportNewsWriter({ passed, rejected });
  return { generated, passed, rejected };
}
