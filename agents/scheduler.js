// scheduler.js
// 承認済み記事をスケジュールに従ってSupabaseに配信する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { reportScheduler } from '../utils/discord.js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// 曜日×エリア定義（scheduler_rules.mdと同期）
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

// ============================================
// 今日のエリア取得
// ============================================
function getTodayArea() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  return AREA_SCHEDULE[day] || AREA_SCHEDULE[0];
}

// ============================================
// カテゴリバランスチェック
// ============================================
async function getTodayPublishedCount(tab, genre = null) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(
    jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()
  )).toISOString();

  let query = supabase
    .from('news_articles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('tab', tab)
    .gte('published_at', todayStart);

  if (genre) query = query.eq('genre', genre);

  const { count } = await query;
  return count || 0;
}

// ============================================
// 承認済み記事取得
// ============================================
async function fetchApprovedArticles(briefingWeek) {
  const { data, error } = await supabase
    .from('news_articles')
    .select('*')
    .eq('status', 'approved')
    .eq('briefing_week', briefingWeek)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================
// 配信実行（人間承認後に呼ばれる）
// ============================================
export async function publishArticle(articleId) {
  const { error } = await supabase
    .from('news_articles')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', articleId);

  if (error) throw error;
}

// 承認待ちリスト取得
export async function getPendingArticles() {
  const { data } = await supabase
    .from('news_articles')
    .select('id, title, tab, tone_score, source_name, created_at')
    .eq('status', 'approved')
    .eq('layer1_result', 'legal_passed')
    .order('created_at', { ascending: true })
    .limit(10);
  return data || [];
}

// ============================================
// メイン実行
// ============================================
export async function runScheduler(briefingWeek) {
  console.log('[scheduler] 開始');

  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'scheduler');

  const todayArea = getTodayArea();
  const articles = await fetchApprovedArticles(briefingWeek);
  console.log(`[scheduler] 承認済み: ${articles.length}件 / 今日のエリア: ${todayArea.label}`);

  let published = 0;
  let skipped = 0;
  const publishedByTab = { bike_news: 0, route: 0, spot: 0 };

  // 優先順位でソート
  // 1. genre=urgent 2. app_db（ルート・スポット） 3. external_rss（バイクニュース） 4. pr
  const sorted = [...articles].sort((a, b) => {
    const priority = (item) => {
      if (item.genre === 'urgent') return 0;
      if (item.source_type === 'app_db') return 1;
      if (item.source_type === 'external_rss') return 2;
      if (item.tab === 'pr') return 3;
      return 4;
    };
    return priority(a) - priority(b);
  });

  for (const article of sorted) {
    try {
      // エリアチェック（app_dbのみ）
      if (article.source_type === 'app_db' && article.area) {
        if (article.area !== todayArea.area && article.genre !== 'urgent') {
          console.log(`[scheduler] エリア不一致スキップ: ${article.title?.slice(0, 20)} (${article.area} ≠ ${todayArea.area})`);
          skipped++;
          continue;
        }
      }

      // カテゴリバランスチェック
      const tab = article.tab;
      if (tab && tab !== 'pr' && tab !== 'announcement' && article.genre !== 'urgent') {
        const todayCount = await getTodayPublishedCount(tab);
        const limit = tab === 'route' ? 3 : tab === 'spot' ? 3 : 5; // bike_news上限5・ルート/スポット上限3
        if (todayCount >= limit) {
          console.log(`[scheduler] バランス上限スキップ: ${tab} (${todayCount}/${limit}件)`);
          skipped++;
          continue;
        }

        // 同一メーカー1日1件チェック（バイクニュースのみ）
        if (tab === 'bike_news' && article.genre) {
          const genreCount = await getTodayPublishedCount(tab, article.genre);
          if (genreCount >= 2) {
            console.log(`[scheduler] ジャンル上限スキップ: ${article.genre} (${genreCount}件)`);
            skipped++;
            continue;
          }
        }
      }

      // 承認依頼をDiscordに送る（自動公開しない）
      published++;
      if (tab && publishedByTab[tab] !== undefined) publishedByTab[tab]++;
      console.log(`[scheduler] 承認依頼: ${article.title?.slice(0, 30)}`);

      // 少し待つ
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`[scheduler] エラー: ${article.id}`, err.message);
    }
  }

  // ログ記録
  await supabase.from('agent_runs').insert({
    agent: 'scheduler',
    task: 'scheduling',
    status: 'success',
    input_count: articles.length,
    output_count: published,
    metadata: { published, skipped, by_tab: publishedByTab, today_area: todayArea.label },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done',
    last_count: published,
    note: `配信${published}件 / スキップ${skipped}件 / エリア:${todayArea.label}`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'scheduler');

  console.log(`[scheduler] 完了: 配信${published}件 / スキップ${skipped}件`);
  await reportScheduler({ published, skipped, todayArea: todayArea.label });
  return { published, skipped, byTab: publishedByTab, todayArea: todayArea.label };
}
