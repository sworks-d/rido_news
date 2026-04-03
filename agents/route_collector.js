// route_collector.js
// アプリDBからルートデータを週次で集計してnews_rawに格納する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// 集計期間取得（前週月曜〜日曜）
// ============================================
function getCollectionPeriod() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay(); // 0=日, 1=月
  const monday = new Date(jst);
  monday.setUTCDate(jst.getUTCDate() - day - 6); // 前週月曜
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  };
}

// ============================================
// タイトルNGワードチェック
// ============================================
const NG_WORDS = ['テスト', 'test', 'TEST', '無題', 'untitled', 'undefined', 'null', 'NULL', 'tmp', 'temp', '仮'];

function hasNgWord(title) {
  return NG_WORDS.some(w => title.toLowerCase().includes(w.toLowerCase()));
}

// ============================================
// スコアリング
// ============================================
function calcRouteScore(route) {
  const routeScore =
    (route.like_count || 0) * 3 +
    (route.view_count || 0) * 1 +
    (route.official_flag ? 10 : 0);

  const spotScore =
    (route.spots_with_desc || 0) * 5 +
    (route.spots_with_photo || 0) * 3 +
    (route.spots_with_tags || 0) * 2;

  return routeScore + spotScore;
}

// ============================================
// ルートデータ取得
// ============================================
async function fetchRoutes(period, briefing) {
  // 優先タグ取得（ブリーフィングから）
  const priorityTags = briefing?.this_week_focus?.themes || [];

  const { data, error } = await supabase
    .from('user_routes')
    .select(`
      id, title, distance_km, spot_count, like_count, view_count,
      official_flag, tags, season, category, prefecture, created_at,
      spots:spots(
        id, description, photo_url, tags
      )
    `)
    .eq('publish_status', 'public')
    .gte('distance_km', 10)
    .gte('created_at', period.start)
    .lt('created_at', period.end)
    .not('spot_count', 'is', null)
    .gt('spot_count', 0);

  if (error) throw error;
  return { routes: data || [], priorityTags };
}

// ============================================
// フィルタリング・スコアリング
// ============================================
function processRoutes(routes, priorityTags) {
  return routes
    .filter(route => {
      // タイトルNGワード
      if (!route.title || hasNgWord(route.title)) return false;

      // スポット品質フィルタ
      const spots = route.spots || [];
      if (spots.length === 0) return false;
      const hasAnyInfo = spots.some(s => s.description || s.photo_url || s.tags);
      if (!hasAnyInfo) return false;

      return true;
    })
    .map(route => {
      const spots = route.spots || [];
      const spotsWithDesc = spots.filter(s => s.description).length;
      const spotsWithPhoto = spots.filter(s => s.photo_url).length;
      const spotsWithTags = spots.filter(s => s.tags).length;

      // 優先タグボーナス
      const routeTags = route.tags || [];
      const hasPriorityTag = priorityTags.some(pt =>
        routeTags.some(rt => rt.includes(pt) || pt.includes(rt))
      );

      const score = calcRouteScore({
        ...route,
        spots_with_desc: spotsWithDesc,
        spots_with_photo: spotsWithPhoto,
        spots_with_tags: spotsWithTags,
      }) + (hasPriorityTag ? 5 : 0);

      // ライダーコメント収集
      const quotedComments = spots
        .filter(s => s.description)
        .map(s => s.description)
        .slice(0, 3);

      return {
        ...route,
        spots_with_desc: spotsWithDesc,
        spots_with_photo: spotsWithPhoto,
        spots_with_tags: spotsWithTags,
        score,
        priority_tag_match: hasPriorityTag,
        quoted_comments: quotedComments,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// ============================================
// recommended_routesでフォールバック
// ============================================
async function fetchFallbackRoutes(count, briefingWeek) {
  const needed = 10 - count;
  if (needed <= 0) return [];

  const { data } = await supabase
    .from('recommended_routes')
    .select('*')
    .limit(needed);

  return (data || []).map(r => ({
    id: r.id,
    title: r.title,
    distance_km: r.distance_km,
    tags: r.tags || [],
    prefecture: r.prefecture,
    score: 0,
    official_flag: true,
    priority_tag_match: false,
    quoted_comments: [],
    is_fallback: true,
  }));
}

// ============================================
// メイン実行
// ============================================
export async function runRouteCollector(briefingWeek, briefing) {
  console.log('[route_collector] 開始');

  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'route_collector');

  const period = getCollectionPeriod();
  console.log(`[route_collector] 集計期間: ${period.start.slice(0,10)} 〜 ${period.end.slice(0,10)}`);

  const { routes, priorityTags } = await fetchRoutes(period, briefing);
  console.log(`[route_collector] 取得: ${routes.length}件`);

  const processed = processRoutes(routes, priorityTags);
  console.log(`[route_collector] フィルタ後: ${processed.length}件`);

  // 10件未満の場合はフォールバック
  const fallback = processed.length < 10
    ? await fetchFallbackRoutes(processed.length, briefingWeek)
    : [];

  const allRoutes = [...processed, ...fallback];

  // news_rawに格納
  let stored = 0;
  for (const route of allRoutes) {
    const { error } = await supabase.from('news_raw').insert({
      source_type: 'app_db',
      content_type: 'route',
      title: route.title,
      route_id: route.id,
      score: route.score,
      official_flag: route.official_flag || false,
      priority_tag_match: route.priority_tag_match || false,
      tags: route.tags || [],
      prefecture: route.prefecture,
      season: route.season,
      quoted_comments: route.quoted_comments || [],
      source_lang: 'ja',
      jp_relevance: 'high',
      briefing_week: briefingWeek,
      status: 'pending',
      fetched_at: new Date().toISOString(),
    });

    if (!error) stored++;
  }

  // ログ記録
  await supabase.from('agent_runs').insert({
    agent: 'route_collector',
    task: 'route_collection',
    status: 'success',
    input_count: routes.length,
    output_count: stored,
    metadata: {
      filtered: processed.length,
      fallback: fallback.length,
      period_start: period.start,
      period_end: period.end,
    },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done',
    last_count: stored,
    note: `収集${routes.length}件 → 格納${stored}件（フォールバック${fallback.length}件）`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'route_collector');

  console.log(`[route_collector] 完了: ${stored}件格納`);
  return { fetched: routes.length, stored, fallback: fallback.length };
}
