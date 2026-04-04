// route_writer.js
// 複数ルートをまとめて今週のルート特集記事を生成する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { reportRouteWriter } from '../utils/discord.js';
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

async function fetchRawRoutes(briefingWeek) {
  const { data, error } = await supabase
    .from('news_raw').select('*')
    .eq('content_type', 'route')
    .eq('status', 'pending')
    .eq('briefing_week', briefingWeek)
    .order('score', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

async function generateRouteArticle(routes, briefing) {
  const weekMessage = briefing?.rido_direction?.message || '今週走られているルートを紹介する';
  const toneGuidance = briefing?.rido_direction?.tone_guidance || 'フラット20% / 俺80%';

  const routeList = routes.map((r, i) => {
    const comment = (r.quoted_comments || [])[0] || null;
    return `${i+1}. 【${r.title}】${r.distance_km||'?'}km / ${r.prefecture||''} / タグ:${(r.tags||[]).join(',')}
   ライダーのコメント（引用必須・改変禁止）:${comment ? `"${comment}"` : 'なし'}`;
  }).join('\n');

  const prompt = `あなたはRIDOというバイクアプリのルート特集ライターです。

## 今週の方針
${weekMessage}

## トーン（${toneGuidance}）
- 全部説明しない。「走りたい」と思わせる概要だけ書く
- 各ルートの紹介は60〜80字。詳細はアプリで見てもらう
- ライダーのコメントは一字一句改変しない
- 断定しない・ランキングしない・命令調禁止・感嘆符2個以内

## 今週のルート一覧（${routes.length}件）
${routeList}

## 出力形式（JSONのみ・前後テキスト不要）
{
  "title": "今週走られているルート（30字以内・件数を含めてもOK）",
  "summary": "今週のルート全体の雰囲気を伝えるリード文（100字以内）",
  "index": ${JSON.stringify(routes.map(r => r.title.slice(0, 15)))},
  "sections": [
    ${routes.map(r => {
      const comment = (r.quoted_comments || [])[0] || null;
      return `{
      "heading": "${r.title.replace(/"/g, '\\"')}",
      "body": "このルートの魅力を60〜80字で。詳細はアプリで確認できる旨を自然に入れる",
      "quoted_comment": ${comment ? `"${comment.replace(/"/g, '\\"').slice(0, 100)}"` : 'null'},
      "link_type": "route",
      "link_id": "${r.route_id}"
    }`;
    }).join(',\n    ')}
  ],
  "tags": ["エリア名","季節","距離感"],
  "selected_theme": "今週のテーマ名",
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

export async function runRouteWriter(briefingWeek) {
  console.log('[route_writer] 開始');

  await supabase.from('agent_status').update({
    status: 'running', last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('agent', 'route_writer');

  const briefing = await getBriefing(briefingWeek);
  const rawRoutes = await fetchRawRoutes(briefingWeek);
  console.log(`[route_writer] 素材: ${rawRoutes.length}件`);

  if (rawRoutes.length === 0) {
    console.log('[route_writer] 素材なし・スキップ');
    return { passed: 0, rejected: 0 };
  }

  let passed = 0;
  let rejected = 0;

  try {
    const article = await generateRouteArticle(rawRoutes, briefing);

    const hook = runHooks(article);
    if (!hook.pass) {
      console.log(`[route_writer] hook失敗: ${hook.reason}`);
      rejected++;
    } else {
      const { error } = await supabase.from('news_articles').insert({
        raw_id: rawRoutes[0].id,
        source_type: 'app_db',
        content_type: 'route',
        category: 'route',
        tab: 'route',
        title: article.title,
        summary: article.summary,
        index_items: article.index,
        sections: article.sections, // link_type・link_idを含むJSONB
        navigation: { related_route_id: null, related_area: null, source_url: null },
        tags: article.tags,
        selected_theme: article.selected_theme,
        tone_score: Math.min(5, Math.max(1, parseInt(article.tone_score) || 4)),
        tone_notes: article.tone_notes,
        layer1_result: 'pending',
        status: 'pending',
        briefing_week: briefingWeek,
      });

      if (error) throw error;
      passed++;

      // 使用した素材を全てdoneに
      await supabase.from('news_raw')
        .update({ status: 'done' })
        .in('id', rawRoutes.map(r => r.id));
    }
  } catch (err) {
    console.error('[route_writer] エラー:', err.message);
    rejected++;
  }

  await supabase.from('agent_runs').insert({
    agent: 'route_writer', task: 'route_writing', status: 'success',
    input_count: rawRoutes.length, output_count: passed,
    metadata: { routes_count: rawRoutes.length, passed, rejected },
    briefing_week: briefingWeek, finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done', last_count: passed,
    note: `${rawRoutes.length}ルートまとめ → ${passed}記事生成`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'route_writer');

  console.log(`[route_writer] 完了: ${passed}記事生成（${rawRoutes.length}ルートまとめ）`);
  await reportRouteWriter({ passed, rejected });
  return { passed, rejected };
}
