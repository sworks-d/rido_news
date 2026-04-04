// spot_collector.js
// アプリDBからスポットデータを曜日×エリアで日次集計してnews_rawに格納する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { notifyFallback, reportSpotCollector } from '../utils/discord.js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// 曜日×エリア定義
// ============================================
const AREA_SCHEDULE = {
  1: { area: 'tohoku', label: '東北', prefectures: ['青森県','岩手県','宮城県','秋田県','山形県','福島県'] },
  2: { area: 'hokkaido', label: '北海道', prefectures: ['北海道'] },
  3: { area: 'hokuriku', label: '北陸・甲信越', prefectures: ['新潟県','富山県','石川県','福井県','長野県','山梨県'] },
  4: { area: 'kyushu', label: '九州・沖縄', prefectures: ['福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'] },
  5: { area: 'tokai', label: '東海', prefectures: ['愛知県','岐阜県','三重県','静岡県'] },
  6: { area: 'kansai', label: '関西・中国・四国', prefectures: ['大阪府','京都府','兵庫県','奈良県','滋賀県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県'] },
  0: { area: 'kanto', label: '関東', prefectures: ['東京都','神奈川県','埼玉県','千葉県','茨城県','栃木県','群馬県'] },
};

function getTomorrowArea() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const tomorrow = (jst.getUTCDay() + 1) % 7;
  return AREA_SCHEDULE[tomorrow] || AREA_SCHEDULE[0];
}

// ============================================
// ユーザー密度確認
// ============================================
async function checkUserDensity(prefectures) {
  const conditions = prefectures.map(p => `areas.ilike.%${p}%`).join(',');
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or(conditions);
  return count || 0;
}

// ============================================
// スコアリング
// ============================================
function calcSpotScore(spot, priorityCategories) {
  const score =
    (spot.view_count || 0) * 1 +
    (spot.description ? 5 : 0) +
    (spot.photo_url ? 3 : 0) +
    (spot.tags ? 2 : 0) +
    (spot.official_flag ? 8 : 0) +
    (priorityCategories.includes(spot.category) ? 5 : 0);
  return score;
}

// ============================================
// スポットデータ取得
// ============================================
async function fetchSpots(area, briefing) {
  const priorityCategories = briefing?.this_week_focus?.themes || [];

  const { data, error } = await supabase
    .from('spots')
    .select('id, name, title, description, photo_url, photo_urls, category, sub_category, tags, prefecture, official_flag, view_count, created_at')
    .eq('is_public', true)
    .eq('publish_status', 'public')
    .in('prefecture', area.prefectures)
    .or('description.not.is.null,photo_url.not.is.null,tags.not.is.null');

  if (error) throw error;
  return { spots: data || [], priorityCategories };
}

// ============================================
// フォールバック（全国）
// ============================================
async function fetchFallbackSpots(briefingWeek) {
  const { data } = await supabase
    .from('spots')
    .select('id, name, title, description, photo_url, category, tags, prefecture, official_flag, view_count')
    .eq('is_public', true)
    .eq('publish_status', 'public')
    .eq('official_flag', true)
    .not('description', 'is', null)
    .limit(10);

  return (data || []).map(s => ({ ...s, is_fallback: true, score: 0 }));
}

// ============================================
// メイン実行
// ============================================
export async function runSpotCollector(briefingWeek, briefing) {
  console.log('[spot_collector] 開始');

  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'spot_collector');

  const area = getTomorrowArea();
  console.log(`[spot_collector] 翌日エリア: ${area.label}`);

  // ユーザー密度確認
  const userCount = await checkUserDensity(area.prefectures);
  let fallbackMode = false;

  if (userCount === 0) {
    console.log(`[spot_collector] ⚠️ エリアのユーザー数0 → フォールバックモード`);
    fallbackMode = true;
    await notifyFallback('spot_collector', `${area.label}エリアのユーザー数が0件 → 全国フォールバックモードで実行`);
  }

  let spots = [];
  let priorityCategories = [];

  if (fallbackMode) {
    spots = await fetchFallbackSpots(briefingWeek);
  } else {
    const result = await fetchSpots(area, briefing);
    spots = result.spots;
    priorityCategories = result.priorityCategories;
  }

  console.log(`[spot_collector] 取得: ${spots.length}件`);

  // スコアリング・ソート
  const scored = spots
    .map(spot => ({
      ...spot,
      score: calcSpotScore(spot, priorityCategories),
      priority_category_match: priorityCategories.includes(spot.category),
    }))
    .sort((a, b) => b.score - a.score);

  // カテゴリ別に上位3件・全体10件まで
  const selected = [];
  const categoryCount = {};

  for (const spot of scored) {
    if (selected.length >= 10) break;
    const cat = spot.category || 'other';
    if (!categoryCount[cat]) categoryCount[cat] = 0;
    if (categoryCount[cat] < 3) {
      selected.push(spot);
      categoryCount[cat]++;
    }
  }

  console.log(`[spot_collector] 選択: ${selected.length}件`);

  // news_rawに格納
  let stored = 0;
  for (const spot of selected) {
    const { error } = await supabase.from('news_raw').insert({
      source_type: 'app_db',
      content_type: 'spot',
      title: spot.name || spot.title,
      spot_id: spot.id,
      score: spot.score,
      official_flag: spot.official_flag || false,
      priority_category_match: spot.priority_category_match || false,
      tags: spot.tags || [],
      prefecture: spot.prefecture,
      area: area.area,
      thumbnail_url: spot.photo_url || (spot.photo_urls && spot.photo_urls[0]) || null,
      fallback_mode: fallbackMode,
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
    agent: 'spot_collector',
    task: 'spot_collection',
    status: 'success',
    input_count: spots.length,
    output_count: stored,
    metadata: {
      area: area.label,
      user_count: userCount,
      fallback_mode: fallbackMode,
      category_distribution: categoryCount,
    },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done',
    last_count: stored,
    note: `${area.label} / ${stored}件格納 / フォールバック:${fallbackMode}`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'spot_collector');

  console.log(`[spot_collector] 完了: ${stored}件格納`);
  await reportSpotCollector({ stored, area: area.label, fallbackMode });
  return { fetched: spots.length, stored, area: area.label, fallbackMode };
}
