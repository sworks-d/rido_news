// route_writer.js
// news_rawのルートデータからルート特集記事を生成してnews_articlesに格納する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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
// 素材取得
// ============================================
async function fetchRawRoutes(briefingWeek) {
  const { data, error } = await supabase
    .from('news_raw')
    .select('*')
    .eq('content_type', 'route')
    .eq('status', 'pending')
    .eq('briefing_week', briefingWeek)
    .order('score', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

// ============================================
// テーマ選択
// ============================================
function selectTheme(raw, briefing) {
  const priorityThemes = briefing?.this_week_focus?.themes || [];
  const avoidThemes = briefing?.this_week_focus?.avoid || [];
  const tags = raw.tags || [];
  const season = raw.season;

  // 避けるテーマは除外
  const availableThemes = priorityThemes.filter(t => !avoidThemes.includes(t));

  // タグとテーマのマッチング
  for (const theme of availableThemes) {
    if (tags.some(tag => tag.includes(theme) || theme.includes(tag))) {
      return theme;
    }
  }

  // 季節マッチング
  if (season) {
    const seasonMap = { '春': '春の桜ロードルート', '夏': '夏の避暑ルート', '秋': '秋の紅葉ワインディング', '冬': '冬でも走れるルート' };
    if (seasonMap[season]) return seasonMap[season];
  }

  // タグベースのデフォルト
  if (tags.some(t => ['温泉', 'onsen'].includes(t))) return '温泉で締める日帰りルート';
  if (tags.some(t => ['絶景', '展望台'].includes(t))) return '絶景狙いのルート';
  if (tags.some(t => ['道の駅'].includes(t))) return '道の駅をつなぐルート';
  if (raw.distance_km >= 200) return 'がっつり走る日帰りロング';
  if (raw.distance_km >= 100) return '日帰りスタンダードルート';
  return '半日でサクッと走るルート';
}

// ============================================
// 記事生成（Anthropic API）
// ============================================
async function generateRouteArticle(raw, briefing) {
  const theme = selectTheme(raw, briefing);
  const weekMessage = briefing?.rido_direction?.message || 'ライダーが心置きなく走り出せるルート特集を作る';
  const toneGuidance = briefing?.rido_direction?.tone_guidance || 'フラット15% / 俺85%';
  const quotedComments = (raw.quoted_comments || []).slice(0, 2);

  const prompt = `あなたはRIDOというバイクアプリのルート特集ライターです。

## 今週の方針
${weekMessage}

## トーン設定（${toneGuidance}・体験ドリブン）
- 断定しない。「〜かもしれない」「〜なルートだ」
- ランキングしない。「最高の」「日本一の」禁止
- 命令調禁止：「〜してください」→「〜するといい」
- 感嘆符は1記事2個以内
- ライダーのコメントは一字一句改変しない

## ルートデータ
タイトル：${raw.title}
距離：${raw.distance_km || '不明'}km
エリア：${raw.prefecture || '不明'}
タグ：${(raw.tags || []).join(', ') || 'なし'}
季節：${raw.season || '不明'}
今週のテーマ：${theme}
ライダーのコメント（引用必須・改変禁止）：
${quotedComments.length > 0 ? quotedComments.map((c, i) => `${i+1}. "${c}"`).join('\n') : 'なし'}

## 出力形式（JSONのみ・前後テキスト不要）
{
  "title": "見出し（30字以内）",
  "summary": "概要（120字以内・3行以内）",
  "index": ["このルートについて（15字以内）","立ち寄りスポット（15字以内）","走ってみた感想（15字以内）"],
  "sections": [
    {"heading":"このルートについて","body":"距離・エリア・テーマの説明（200字以内）","quoted_comment":null},
    {"heading":"立ち寄りスポット","body":"スポットの紹介文（200字以内）","quoted_comment":"${quotedComments[0] || null}"},
    {"heading":"走ってみた感想","body":"ルート全体の印象（200字以内）","quoted_comment":"${quotedComments[1] || null}"}
  ],
  "tags": ["タグ1","タグ2","タグ3"],
  "selected_theme": "${theme}",
  "tone_score": 4,
  "tone_notes": "修正内容があれば記載"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = data.content[0]?.text || '';

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error(`JSON parse error: ${text.slice(0, 100)}`);
  }
}

// ============================================
// hookチェック
// ============================================
function runHooks(article, raw) {
  if ((article.title?.length || 0) > 30) return { pass: false, reason: 'hook_2: titleが30字超' };
  if ((article.summary?.length || 0) > 250) return { pass: false, reason: 'hook_3: summaryが250字超' };
  if (!raw.route_id) return { pass: false, reason: 'hook_4: route_idがnull' };
  if ((article.index?.length || 0) !== (article.sections?.length || 0)) {
    return { pass: false, reason: 'hook_7: index数とsections数が不一致' };
  }
  return { pass: true };
}

// ============================================
// メイン実行
// ============================================
export async function runRouteWriter(briefingWeek) {
  console.log('[route_writer] 開始');

  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'route_writer');

  const briefing = await getBriefing(briefingWeek);
  const rawRoutes = await fetchRawRoutes(briefingWeek);
  console.log(`[route_writer] 素材: ${rawRoutes.length}件`);

  let passed = 0;
  let rejected = 0;

  for (const raw of rawRoutes) {
    try {
      const article = await generateRouteArticle(raw, briefing);

      const hook = runHooks(article, raw);
      if (!hook.pass) {
        console.log(`[route_writer] hook失敗: ${hook.reason}`);
        await supabase.from('news_raw').update({ status: 'error' }).eq('id', raw.id);
        rejected++;
        continue;
      }

      const { error } = await supabase.from('news_articles').insert({
        raw_id: raw.id,
        source_type: 'app_db',
        content_type: 'route',
        category: 'route',
        tab: 'route',
        title: article.title,
        summary: article.summary,
        index_items: article.index,
        sections: article.sections,
        navigation: {
          related_route_id: raw.route_id,
          related_area: raw.area,
          source_url: null,
        },
        tags: article.tags,
        selected_theme: article.selected_theme,
        tone_score: article.tone_score,
        tone_notes: article.tone_notes,
        route_id: raw.route_id,
        area: raw.area,
        prefecture: raw.prefecture,
        layer1_result: 'pending',
        status: 'pending',
        briefing_week: briefingWeek,
      });

      if (error) throw error;

      await supabase.from('news_raw').update({ status: 'done' }).eq('id', raw.id);
      passed++;

      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`[route_writer] エラー: ${raw.title?.slice(0, 30)}`, err.message);
      rejected++;
      await supabase.from('news_raw').update({ status: 'error' }).eq('id', raw.id);
    }
  }

  await supabase.from('agent_runs').insert({
    agent: 'route_writer',
    task: 'route_writing',
    status: 'success',
    input_count: rawRoutes.length,
    output_count: passed,
    metadata: { passed, rejected },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done',
    last_count: passed,
    note: `生成${passed}件 / 却下${rejected}件`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'route_writer');

  console.log(`[route_writer] 完了: ${passed}件格納 / ${rejected}件却下`);
  return { passed, rejected };
}
