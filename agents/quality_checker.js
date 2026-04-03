// quality_checker.js
// news_articlesをLayer1〜3で判定してhookでDB投入を制御する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// Layer 1: 即リジェクト判定
// ============================================

// 有害表現
const HARMFUL_WORDS = [
  '差別', '暴力', '誹謗', '中傷', 'ヘイト',
];

// 危険運転助長
const DANGEROUS_WORDS = [
  '速度無制限', '信号無視', '無免許', '法定速度を超えて走れ',
  'スピードを出しまくれ', '暴走',
];

// ランキング・最上級（Layer3でもチェック）
const RANKING_WORDS = [
  '1位', '2位', 'ランキング', 'TOP', '日本一', '最強', 'No.1',
  'ナンバーワン', '世界一',
];

// 煽り系
const HYPE_WORDS = [
  '驚きの', '衝撃の', 'まさか', '信じられない',
];

function layer1Check(article, raw) {
  const text = `${article.title} ${article.summary} ${JSON.stringify(article.sections)}`;

  // 有害表現
  for (const word of HARMFUL_WORDS) {
    if (text.includes(word)) return { pass: false, reason: `有害表現検出: ${word}` };
  }

  // 危険運転助長
  for (const word of DANGEROUS_WORDS) {
    if (text.includes(word)) return { pass: false, reason: `危険運転助長: ${word}` };
  }

  // 著作権リスク（external_rssのみ）
  if (raw?.source_type === 'external_rss' && raw?.body) {
    const bodyLen = raw.body.length;
    const summaryLen = article.summary?.length || 0;
    if (bodyLen > 0 && summaryLen / bodyLen > 0.2) {
      return { pass: false, reason: `著作権リスク: summary/body比率超過 (${(summaryLen/bodyLen*100).toFixed(1)}%)` };
    }

    // 15字以上の連続一致チェック
    const summaryText = article.summary || '';
    for (let i = 0; i < summaryText.length - 14; i++) {
      const phrase = summaryText.slice(i, i + 15);
      if (raw.body.includes(phrase)) {
        return { pass: false, reason: `著作権リスク: 15字以上の連続一致フレーズ検出` };
      }
    }
  }

  return { pass: true };
}

// ============================================
// Layer 2: 品質スコア（100点満点）
// ============================================
function layer2Score(article, raw) {
  let score = 0;
  const breakdown = {};

  // 文字数（20点）
  const titleLen = article.title?.length || 0;
  const summaryLen = article.summary?.length || 0;
  if (titleLen >= 5 && titleLen <= 30 && summaryLen >= 30 && summaryLen <= 250) {
    score += 20; breakdown.length = 20;
  } else {
    score += 10; breakdown.length = 10;
  }

  // 構成（20点）
  const hasAllFields = article.title && article.summary &&
    Array.isArray(article.index) && article.index.length >= 3 &&
    Array.isArray(article.sections) && article.sections.length >= 3;
  if (hasAllFields) {
    score += 20; breakdown.structure = 20;
  } else {
    score += 0; breakdown.structure = 0;
  }

  // 情報鮮度（20点）
  if (raw?.source_type === 'app_db') {
    score += 20; breakdown.freshness = 20;
  } else if (raw?.fetched_at) {
    const age = Date.now() - new Date(raw.fetched_at).getTime();
    const days = age / (1000 * 60 * 60 * 24);
    if (days <= 1) { score += 20; breakdown.freshness = 20; }
    else if (days <= 3) { score += 15; breakdown.freshness = 15; }
    else if (days <= 7) { score += 10; breakdown.freshness = 10; }
    else { score += 0; breakdown.freshness = 0; }
  }

  // カテゴリ整合（20点）
  const categoryMatch = article.category && article.summary &&
    article.summary.length > 10;
  if (categoryMatch) {
    score += 20; breakdown.category = 20;
  } else {
    score += 10; breakdown.category = 10;
  }

  // ソース信頼性（20点）
  if (raw?.source_type === 'app_db') {
    score += 20; breakdown.trust = 20;
  } else {
    const trust = raw?.trust_score || 0;
    if (trust >= 90) { score += 20; breakdown.trust = 20; }
    else if (trust >= 80) { score += 15; breakdown.trust = 15; }
    else if (trust >= 70) { score += 10; breakdown.trust = 10; }
    else { score += 5; breakdown.trust = 5; }
  }

  return { score, breakdown };
}

// ============================================
// Layer 3: トーンチェック・自動修正
// ============================================
function layer3Check(article) {
  const fixed = [];
  let text = JSON.stringify(article);

  // 即アラート対象
  for (const word of RANKING_WORDS) {
    if (text.includes(word)) {
      return { result: 'alert', fixed: [], reason: `ランキング・最上級表現検出: ${word}` };
    }
  }
  for (const word of HYPE_WORDS) {
    if (text.includes(word)) {
      return { result: 'alert', fixed: [], reason: `煽り系表現検出: ${word}` };
    }
  }

  // 自動修正: 命令調
  const replacements = [
    { from: /してください/g, to: 'するといい' },
    { from: /しましょう/g, to: 'するのもあり' },
    { from: /すべきです/g, to: 'かもしれない' },
    { from: /必須です/g, to: 'あると安心' },
  ];

  let modified = JSON.stringify(article);
  for (const r of replacements) {
    if (r.from.test(modified)) {
      modified = modified.replace(r.from, r.to);
      fixed.push(`命令調修正: ${r.from} → ${r.to}`);
    }
  }

  // 自動修正: 締めの定型文
  const closingPatterns = [
    /いかがでしたか[？?]/g,
    /ぜひ参考にしてください/g,
    /最後までお読みいただきありがとうございました/g,
  ];
  for (const p of closingPatterns) {
    if (p.test(modified)) {
      modified = modified.replace(p, '');
      fixed.push(`締め定型文を削除`);
    }
  }

  // 感嘆符チェック
  const exclamCount = (modified.match(/[！!]/g) || []).length;
  if (exclamCount > 2) {
    let count = 0;
    modified = modified.replace(/[！!]/g, (m) => {
      count++;
      return count <= 2 ? m : '';
    });
    fixed.push(`感嘆符を${exclamCount}個→2個に削減`);
  }

  if (fixed.length > 0) {
    try {
      const corrected = JSON.parse(modified);
      return { result: 'auto_fixed', fixed, corrected };
    } catch {
      return { result: 'pass', fixed: [] };
    }
  }

  return { result: 'pass', fixed: [] };
}

// ============================================
// hook: DB投入前の物理チェック
// ============================================
function runHooks(article, raw) {
  if (raw?.source_type === 'external_rss' && !article.navigation?.source_url) {
    return { pass: false, reason: 'hook_1: source_urlがnull' };
  }
  if ((article.title?.length || 0) > 30) {
    return { pass: false, reason: 'hook_2: titleが30字超' };
  }
  if ((article.summary?.length || 0) > 250) {
    return { pass: false, reason: 'hook_3: summaryが250字超' };
  }
  if (article.content_type === 'route' && !article.route_id) {
    return { pass: false, reason: 'hook_4: route_idがnull' };
  }
  if (article.content_type === 'spot' && !article.spot_id) {
    return { pass: false, reason: 'hook_5: spot_idがnull' };
  }
  if ((article.index_items?.length || 0) !== (article.sections?.length || 0)) {
    return { pass: false, reason: 'hook_7: index数とsections数が不一致' };
  }
  return { pass: true };
}

// ============================================
// メイン実行
// ============================================
export async function runQualityChecker(briefingWeek) {
  console.log('[quality_checker] 開始');

  await supabase.from('agent_status').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agent', 'quality_checker');

  // pending状態の記事を取得
  const { data: articles, error } = await supabase
    .from('news_articles')
    .select('*, news_raw(*)')
    .eq('status', 'pending')
    .eq('briefing_week', briefingWeek)
    .limit(50);

  if (error) throw error;
  console.log(`[quality_checker] 判定対象: ${articles?.length || 0}件`);

  let approved = 0;
  let autoFixed = 0;
  let pendingReview = 0;

  for (const article of articles || []) {
    const raw = article.news_raw;
    let currentArticle = { ...article };
    let layer1Result = 'pass';
    let layer2Result = { score: 0, breakdown: {} };
    let layer3Result = { result: 'pass', fixed: [] };
    let action = 'approved';

    try {
      // hook（最初に実行）
      const hook = runHooks(article, raw);
      if (!hook.pass) {
        await supabase.from('news_articles')
          .update({ status: 'rejected', hook_result: hook.reason })
          .eq('id', article.id);
        await logQuality(article.id, 'pass', null, null, null, hook.reason, 'rejected');
        continue;
      }

      // Layer 1
      const l1 = layer1Check(article, raw);
      if (!l1.pass) {
        layer1Result = l1.reason;
        action = 'pending_review';
        await supabase.from('news_articles').update({
          status: 'pending_review',
          layer1_result: l1.reason,
        }).eq('id', article.id);
        await logQuality(article.id, l1.reason, null, null, 'pass', null, 'pending_review');
        pendingReview++;
        continue;
      }

      // Layer 2
      layer2Result = layer2Score(article, raw);

      // Layer 3
      layer3Result = layer3Check(article);

      if (layer3Result.result === 'alert') {
        action = 'pending_review';
        await supabase.from('news_articles').update({
          status: 'pending_review',
          layer2_score: layer2Result.score,
          layer3_result: 'alert',
        }).eq('id', article.id);
        await logQuality(article.id, 'pass', layer2Result.score, 'alert', 'pass', layer3Result.reason, 'pending_review');
        pendingReview++;
        continue;
      }

      // 自動修正があった場合は記事を更新
      if (layer3Result.result === 'auto_fixed' && layer3Result.corrected) {
        const corrected = layer3Result.corrected;
        await supabase.from('news_articles').update({
          title: corrected.title,
          summary: corrected.summary,
          sections: corrected.sections,
        }).eq('id', article.id);
        autoFixed++;
      }

      // 品質スコアが低い場合は承認待ち
      if (layer2Result.score < 70) {
        action = 'pending_review';
        await supabase.from('news_articles').update({
          status: 'pending_review',
          layer1_result: 'pass',
          layer2_score: layer2Result.score,
          layer3_result: layer3Result.result,
          layer3_fixed: layer3Result.fixed,
        }).eq('id', article.id);
        await logQuality(article.id, 'pass', layer2Result.score, layer3Result.result, 'pass', `スコア不足(${layer2Result.score})`, 'pending_review');
        pendingReview++;
        continue;
      }

      // 全通過 → 承認
      await supabase.from('news_articles').update({
        status: 'approved',
        layer1_result: 'pass',
        layer2_score: layer2Result.score,
        layer3_result: layer3Result.result,
        layer3_fixed: layer3Result.fixed,
        hook_result: 'pass',
      }).eq('id', article.id);

      await logQuality(article.id, 'pass', layer2Result.score, layer3Result.result, 'pass', null, 'approved');
      approved++;

    } catch (err) {
      console.error(`[quality_checker] エラー: ${article.id}`, err.message);
    }
  }

  // ログ記録
  await supabase.from('agent_runs').insert({
    agent: 'quality_checker',
    task: 'quality_check',
    status: 'success',
    input_count: articles?.length || 0,
    output_count: approved + autoFixed,
    metadata: { approved, auto_fixed: autoFixed, pending_review: pendingReview },
    briefing_week: briefingWeek,
    finished_at: new Date().toISOString(),
  });

  await supabase.from('agent_status').update({
    status: 'done',
    last_count: approved + autoFixed,
    note: `承認${approved}件 / 自動修正${autoFixed}件 / 審査待ち${pendingReview}件`,
    updated_at: new Date().toISOString(),
  }).eq('agent', 'quality_checker');

  console.log(`[quality_checker] 完了: 承認${approved} / 自動修正${autoFixed} / 審査待ち${pendingReview}`);
  return { approved, autoFixed, pendingReview };
}

// ============================================
// 品質ログ記録
// ============================================
async function logQuality(articleId, l1, l2Score, l3Result, hookResult, reason, action) {
  await supabase.from('news_quality_log').insert({
    article_id: articleId,
    layer1_result: l1,
    layer2_score: l2Score,
    layer3_result: l3Result,
    hook_result: hookResult,
    hook_reason: reason,
    action,
  });
}
