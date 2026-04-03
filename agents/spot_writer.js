// spot_writer.js
// news_rawのスポットデータからエリア特集記事を生成してnews_articlesに格納する

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
async function fetchRawSpots(briefingWeek) {
  const { data, error } = await supabase
    .from('news_raw')
    .select('*')
    .eq('content_type', 'spot')
    .eq('status', 'pending')
    .eq('briefing_week', briefingWeek)
    .order('score', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

// ============================================
// スポットの説明文取得（DBから直接）
// ============================================
async function fetchSpotDescription(spotId) {
  const { data } = await supabase
    .from('spots')
    .select('description, photo_url, photo_urls')
    .eq('id', spotId)
    .single();
  return data;
}

// ============================================
// テーマ選択
// ============================================
function selectSpotTheme(raw, briefing) {
  const priorityThemes = briefing?.this_week_focus?.themes || [];
  const category = raw.category || '';
  const tags = raw.tags || [];

  // 優先テーマとのマッチング
  for (const theme of priorityThemes) {
    if (category.includes(theme) || tags.some(t => t.includes(theme))) {
      return theme;
    }
  }

  // カテゴリベースのデフォルト
  if (category.includes('温泉')) return 'ライダーが集まる温泉';
  if (category.includes('絶景') || category.includes('展望')) return '絶景展望台スポット';
  if (category.includes('道の駅')) return 'ライダーに人気の道の駅';
  if (category.includes('歴史')) return '歴史的建造物を巡る';
  if (tags.some(t => ['滝', '湖', '川'].includes(t))) return '水が綺麗な場所';
  return `${raw.area || ''}エリアのおすすめスポット`;
}

// ============================================
// 記事生成（Anthropic API）
// ============================================
async function generateSpotArticle(raw, briefing) {
  const theme = selectSpotTheme(raw, briefing);
  const weekMessage = briefing?.rido_direction?.message || 'ライダーが走りたくなるスポット特集を作る';
  const toneGuidance = briefing?.rido_direction?.tone_guidance || 'フラット15% / 俺85%';

  // スポットの説明文をDBから取得
  let spotDescription = null;
  if (raw.spot_id) {
    const spotData = await fetchSpotDescription(raw.spot_id);
    spotDescription = spotData?.description || null;
  }

  const prompt = `あなたはRIDOというバイクアプリのスポット特集ライターです。

## 今週の方針
${weekMessage}

## トーン設定（${toneGuidance}・体験ドリブン）
- 断定しない。「〜かもしれない」「〜な場所だ」
- ランキングしない。「最高の」「日本一の」禁止
- 命令調禁止：「〜してください」→「〜するといい」
- 感嘆符は1記事2個以内
- ライダーのコメントは一字一句改変しない

## スポットデータ
スポット名：${raw.title}
カテゴリ：${raw.category || '不明'}
エリア：${raw.area || '不明'}（${raw.prefecture || '不明'}）
タグ：${(raw.tags || []).join(', ') || 'なし'}
今週のテーマ：${theme}
ライダーが書いた説明文（引用必須・改変禁止）：
${spotDescription ? `"${spotDescription}"` : 'なし（説明文がないため自分で想像して書く）'}

## 出力形式（JSONのみ・前後テキスト不要）
{
  "title": "見出し（30字以内）",
  "summary": "概要（120字以内・3行以内）",
  "index": ["このスポットについて（15字以内）","ここが良かった（15字以内）","行くときのポイント（15字以内）"],
  "sections": [
    {"heading":"このスポットについて","body":"エリア・カテゴリ・基本情報（200字以内）","quoted_comment":null},
    {"heading":"ここが良かった","body":"スポットの魅力（200字以内）","quoted_comment":${spotDescription ? `"${spotDescription.replace(/"/g, '\\"')}"` : 'null'}},
    {"heading":"行くときのポイント","body":"アクセス・季節・注意点など（200字以内）","quoted_comment":null}
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
  if (!raw.spot_id) return { pass: false, reason: 'hook_5: spot_idがnull' };
  if ((article.index?.length || 0) !== (article.sections?.length || 0)) {
    return { pass: false, reason: 'hook_7: index数とsections数が不一致' };
  }
  return { pass: true };
}

// ============================================
// メイン実行
// ============================================
export async function runSpotWriter(briefingWeek) {
  console.log('[spot_writer] 開始');

  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'spot_writer');

  const briefing = await getBriefing(briefingWeek);
  const rawSpots = await fetchRawSpots(briefingWeek);
  console.log(`[spot_writer] 素材: ${rawSpots.length}件`);

  let passed = 0;
  let rejected = 0;

  for (const raw of rawSpots) {
    try {
      const article = await generateSpotArticle(raw, briefing);

      const hook = runHooks(article, raw);
      if (!hook.pass) {
        console.log(`[spot_writer] hook失敗: ${hook.reason}`);
        await supabase.from('news_raw').update({ status: 'error' }).eq('id', raw.id);
        rejected++;
        continue;
      }

      const { error } = await supabase.from('news_articles').insert({
        raw_id: raw.id,
        source_type: 'app_db',
        content_type: 'spot',
        category: 'spot',
        tab: 'spot',
        title: article.title,
        summary: article.summary,
        index_items: article.index,
        sections: article.sections,
        navigation: {
          related_route_id: null,
          related_area: raw.area,
          source_url: null,
        },
        tags: article.tags,
        selected_theme: article.selected_theme,
        tone_score: article.tone_score,
        tone_notes: article.tone_notes,
        spot_id: raw.spot_id,
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
      console.error(`[spot_writer] エラー: ${raw.title?.slice(0, 30)}`, err.message);
      rejected++;
      await supabase.from('news_raw').update({ status: 'error' }).eq('id', raw.id);
    }
  }

  await supabase.from('agent_runs').insert({
    agent: 'spot_writer',
    task: 'spot_writing',
    status: 'success',
    input_count: rawSpots.length,
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
  }).eq('agent', 'spot_writer');

  console.log(`[spot_writer] 完了: ${passed}件格納 / ${rejected}件却下`);
  return { passed, rejected };
}
