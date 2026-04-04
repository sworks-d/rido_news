// spot_writer.js
// 複数スポットをまとめてエリア特集記事を生成する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { reportSpotWriter } from '../utils/discord.js';
config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getBriefing(briefingWeek) {
  const { data } = await supabase
    .from('weekly_briefings').select('*')
    .eq('briefing_week', briefingWeek).single();
  return data;
}

async function fetchRawSpots(briefingWeek) {
  const { data, error } = await supabase
    .from('news_raw').select('*')
    .eq('content_type', 'spot')
    .eq('status', 'pending')
    .eq('briefing_week', briefingWeek)
    .order('score', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

async function fetchSpotDetail(spotId) {
  const { data } = await supabase
    .from('spots')
    .select('id, name, description, photo_url, category, prefecture')
    .eq('id', spotId).single();
  return data;
}

async function generateSpotArticle(spots, area, briefing) {
  const weekMessage = briefing?.rido_direction?.message || 'ライダーが走りたくなるスポット特集を作る';
  const toneGuidance = briefing?.rido_direction?.tone_guidance || 'フラット20% / 俺80%';

  const spotList = spots.map((s, i) =>
    `${i+1}. 【${s.name}】カテゴリ:${s.category||'不明'} / ${s.prefecture||''}
   説明文（引用必須・改変禁止）:"${s.description||'なし'}"`
  ).join('\n');

  const prompt = `あなたはRIDOというバイクアプリのスポット特集ライターです。

## 今週の方針
${weekMessage}

## トーン（${toneGuidance}）
- 全部説明しない。「行きたい」と思わせる概要だけ書く
- 各スポットの紹介は60〜80字。詳細はアプリで見てもらう
- ライダーの説明文は一字一句改変しない
- 断定しない・ランキングしない・命令調禁止・感嘆符2個以内

## 対象エリア
${area}

## スポット一覧（${spots.length}件）
${spotList}

## 出力形式（JSONのみ・前後テキスト不要）
{
  "title": "今週の○○エリアおすすめスポット（30字以内）",
  "summary": "エリア全体の魅力を伝えるリード文（100字以内）",
  "index": ${JSON.stringify(spots.map(s => s.name.slice(0, 15)))},
  "sections": [
    ${spots.map(s => `{
      "heading": "${s.name}",
      "body": "このスポットの魅力を60〜80字で。詳細はアプリで確認できる旨を自然に入れる",
      "quoted_comment": "${(s.description||'').replace(/"/g, '\\"').slice(0, 100)}",
      "link_type": "spot",
      "link_id": "${s.spot_id}"
    }`).join(',\n    ')}
  ],
  "tags": ["エリア名","カテゴリ1","カテゴリ2"],
  "selected_theme": "テーマ名",
  "tone_score": 4,
  "tone_notes": ""
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
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = data.content[0]?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function runHooks(article) {
  if ((article.title?.length || 0) > 30) return { pass: false, reason: 'hook_2: titleが30字超' };
  if ((article.summary?.length || 0) > 250) return { pass: false, reason: 'hook_3: summaryが250字超' };
  if ((article.index?.length || 0) !== (article.sections?.length || 0)) {
    return { pass: false, reason: 'hook_7: index数とsections数が不一致' };
  }
  return { pass: true };
}

export async function runSpotWriter(briefingWeek) {
  console.log('[spot_writer] 開始');

  await supabase.from('agent_status').update({
    status: 'running', last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('agent', 'spot_writer');

  const briefing = await getBriefing(briefingWeek);
  const rawSpots = await fetchRawSpots(briefingWeek);
  console.log(`[spot_writer] 素材: ${rawSpots.length}件`);

  if (rawSpots.length === 0) {
    console.log('[spot_writer] 素材なし・スキップ');
    return { passed: 0, rejected: 0 };
  }

  // spot_idでスポット詳細を取得
  const spotsWithDetail = await Promise.all(
    rawSpots.map(async raw => {
      const detail = raw.spot_id ? await fetchSpotDetail(raw.spot_id) : null;
      return {
        ...raw,
        name: detail?.name || raw.title,
        description: detail?.description || null,
        category: detail?.category || raw.category,
        prefecture: detail?.prefecture || raw.prefecture,
      };
    })
  );

  // エリアを取得（最初の素材から）
  const area = rawSpots[0]?.area || 'エリア不明';
  const areaLabel = {
    tokai: '東海', kanto: '関東', kansai: '関西・中国・四国',
    tohoku: '東北', hokkaido: '北海道', hokuriku: '北陸・甲信越', kyushu: '九州・沖縄',
  }[area] || area;

  let passed = 0;
  let rejected = 0;

  try {
    const article = await generateSpotArticle(spotsWithDetail, areaLabel, briefing);

    const hook = runHooks(article);
    if (!hook.pass) {
      console.log(`[spot_writer] hook失敗: ${hook.reason}`);
      rejected++;
    } else {
      const { error } = await supabase.from('news_articles').insert({
        raw_id: rawSpots[0].id,
        source_type: 'app_db',
        content_type: 'spot',
        category: 'spot',
        tab: 'spot',
        title: article.title,
        summary: article.summary,
        index_items: article.index,
        sections: article.sections, // link_type・link_idを含むJSONB
        navigation: { related_route_id: null, related_area: area, source_url: null },
        tags: article.tags,
        selected_theme: article.selected_theme,
        tone_score: article.tone_score,
        tone_notes: article.tone_notes,
        area,
        thumbnail_url: raw.thumbnail_url || null,
        layer1_result: 'pending',
        status: 'pending',
        briefing_week: briefingWeek,
      });

      if (error) throw error;
      passed++;

      // 使用した素材を全てdoneに
      await supabase.from('news_raw')
        .update({ status: 'done' })
        .in('id', rawSpots.map(r => r.id));
    }
  } catch (err) {
    console.error('[spot_writer] エラー:', err.message);
    rejected++;
  }

  await supabase.from('agent_runs').insert({
    agent: 'spot_writer', task: 'spot_writing', status: 'success',
    input_count: rawSpots.length, output_count: passed,
    metadata: { spots_count: rawSpots.length, passed, rejected, area: areaLabel },
    briefing_week: briefingWeek, finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done', last_count: passed,
    note: `${areaLabel} ${rawSpots.length}件まとめ → ${passed}記事生成`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'spot_writer');

  console.log(`[spot_writer] 完了: ${passed}記事生成（${rawSpots.length}スポットまとめ）`);
  await reportSpotWriter({ passed, area: areaLabel });
  return { passed, rejected };
}
