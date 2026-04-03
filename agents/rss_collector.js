// rss_collector.js
// RSSからバイクニュースを収集してnews_rawに格納する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';
import { notifyAgentError, reportRssCollector } from '../utils/discord.js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// RSSソース定義（rss_sources.mdと同期）
// ============================================
const RSS_SOURCES = [
  // 国内メーカー公式
  { url: 'https://www.kawasaki-motors.com/ja/news/rss/', name: 'Kawasaki', trust_score: 95, lang: 'ja' },
  { url: 'https://www1.suzuki.co.jp/motor/rss/news.xml', name: 'Suzuki', trust_score: 95, lang: 'ja' },
  // 日本語メディア
  { url: 'https://news.webike.net/feed/', name: 'Webikeプラス', trust_score: 85, lang: 'ja' },
  { url: 'https://mc-web.jp/feed/', name: 'モーサイ', trust_score: 85, lang: 'ja' },
  { url: 'https://news.bikebros.co.jp/feed/', name: 'バイクブロスマガジンズ', trust_score: 85, lang: 'ja' },
  // 英語メディア
  { url: 'https://www.totalmotorcycle.com/feed/', name: 'Total Motorcycle', trust_score: 82, lang: 'en' },
  { url: 'https://www.motorcycles.news/en/feed/', name: 'Motorcycles.News', trust_score: 82, lang: 'en' },
  { url: 'https://www.rideapart.com/rss/articles/all', name: 'RideApart', trust_score: 82, lang: 'en' },
  // イベント
  { url: 'https://www.motorcycleshow.org/rss/', name: '東京モーターサイクルショー', trust_score: 80, lang: 'ja' },
];

// ============================================
// バイク関連キーワード
// ============================================
const BIKE_KEYWORDS = [
  'バイク', 'オートバイ', 'モーターサイクル', '二輪',
  'motorcycle', 'bike', 'moto', 'motorbike',
  'ツーリング', 'ライダー', 'ライディング',
];

const EXCLUDE_KEYWORDS = [
  '自転車', 'ロードバイク', 'クロスバイク', 'MTB',
  '競馬', '競輪', 'オートレース',
];

// 日本未発売フラグキーワード
const JP_LOW_KEYWORDS = [
  'US only', 'US market', 'North America only',
  'UK only', 'Europe only', 'not available in Japan',
  'US-spec', 'European spec',
];
const JP_HIGH_KEYWORDS = [
  'Japan', '日本', '国内', '国内導入', '日本発売',
  'Asia', 'アジア', 'Japanese spec', 'Japan-spec',
];

// ============================================
// RSSフェッチ
// ============================================
async function fetchRSS(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RIDO-NewsAgent/1.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ============================================
// RSS XML パース（簡易）
// ============================================
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const get = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const title = get('title');
    const link = get('link') || itemXml.match(/<link[^>]*\/?>([^<]*)/i)?.[1]?.trim() || '';
    const pubDate = get('pubDate') || get('dc:date') || get('published');
    const description = get('description') || get('content:encoded') || get('summary');

    if (title && link) {
      items.push({ title, link, pubDate, description });
    }
  }
  return items;
}

// ============================================
// フィルタリング
// ============================================
function filterItems(items, source) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return items.filter(item => {
    // 日付フィルタ
    if (item.pubDate) {
      const pub = new Date(item.pubDate).getTime();
      if (isNaN(pub) || now - pub > sevenDays) return false;
    }

    // 英語ソースのキーワードフィルタ
    if (source.lang === 'en') return true;

    // 日本語ソースのキーワードフィルタ
    const text = `${item.title} ${item.description}`.toLowerCase();
    const hasBike = BIKE_KEYWORDS.some(k => text.includes(k.toLowerCase()));
    const hasExclude = EXCLUDE_KEYWORDS.some(k => text.includes(k.toLowerCase()));
    return hasBike && !hasExclude;
  });
}

// ============================================
// jp_relevance判定
// ============================================
function detectJpRelevance(item, source) {
  if (source.lang === 'ja') return 'high';
  const text = `${item.title} ${item.description}`;
  if (JP_HIGH_KEYWORDS.some(k => text.includes(k))) return 'high';
  if (JP_LOW_KEYWORDS.some(k => text.toLowerCase().includes(k.toLowerCase()))) return 'low';
  return 'unknown';
}

// ============================================
// メイン実行
// ============================================
export async function runRssCollector(briefingWeek) {
  console.log('[rss_collector] 開始');

  let totalFetched = 0;
  let totalPassed = 0;
  let totalDuplicate = 0;

  // status-board更新
  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'rss_collector');

  for (const source of RSS_SOURCES) {
    try {
      console.log(`[rss_collector] ${source.name} 収集中...`);
      const xml = await fetchRSS(source);
      const items = parseRSS(xml);
      const filtered = filterItems(items.slice(0, 20), source);
      totalFetched += items.length;

      for (const item of filtered) {
        const hash = crypto.createHash('md5')
          .update(`${item.title}${item.link}`)
          .digest('hex');

        // 重複チェック
        const { data: existing } = await supabase
          .from('news_raw')
          .select('id')
          .eq('duplicate_hash', hash)
          .single();

        if (existing) {
          totalDuplicate++;
          continue;
        }

        const jpRelevance = detectJpRelevance(item, source);

        const { error } = await supabase.from('news_raw').insert({
          source_type: 'external_rss',
          content_type: 'bike_news',
          source_url: item.link,
          source_name: source.name,
          title: item.title,
          body: item.description?.slice(0, 2000) || '',
          trust_score: source.trust_score,
          duplicate_hash: hash,
          source_lang: source.lang,
          jp_relevance: jpRelevance,
          briefing_week: briefingWeek,
          status: 'pending',
          fetched_at: new Date().toISOString(),
        });

        if (!error) totalPassed++;
      }
    } catch (err) {
      console.error(`[rss_collector] ${source.name} エラー:`, err.message);
      // 連続エラーは呼び出し元でまとめて通知
    }
  }

  // ログ記録
  await supabase.from('agent_runs').insert({
    agent: 'rss_collector',
    task: 'rss_collection',
    status: 'success',
    input_count: totalFetched,
    output_count: totalPassed,
    metadata: { duplicate: totalDuplicate },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  // status-board更新
  await supabase.from('agent_status').update({
    status: 'done',
    last_count: totalPassed,
    note: `収集${totalFetched}件 → 格納${totalPassed}件`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'rss_collector');

  console.log(`[rss_collector] 完了: ${totalPassed}件格納`);
  await reportRssCollector({ passed: totalPassed, fetched: totalFetched, duplicate: totalDuplicate });
  return { fetched: totalFetched, passed: totalPassed, duplicate: totalDuplicate };
}
