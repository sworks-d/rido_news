// legal_checker.js
// バイクニュース記事のリーガルチェック（Pass/Fail）
// quality_checkerの後に実行する

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { notifyLayer1, notifyAgentError } from '../utils/discord.js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// チェック項目
// ============================================

// 1. 文章類似チェック（15字以上一致）
function checkTextSimilarity(article, raw) {
  if (!raw?.body) return { pass: true };
  const body = raw.body;

  // 引用元section（link_type: external）を除いた本文のみチェック
  const contentSections = (article.sections || []).filter(s => s.link_type !== 'external');
  const articleText = contentSections.map(s => s.body || '').join(' ');

  for (let i = 0; i < body.length - 14; i++) {
    const phrase = body.slice(i, i + 15);
    // 数字・記号・URLのみのフレーズはスキップ
    if (/^[\d\s\.,、。・「」【】\-]+$/.test(phrase)) continue;
    if (/^https?:\/\//.test(phrase)) continue;
    if (articleText.includes(phrase)) {
      return {
        pass: false,
        reason: `文章類似検出: 「${phrase.slice(0, 20)}...」が元記事と一致`,
      };
    }
  }
  return { pass: true };
}

// 2. スペック推測チェック
function checkSpeculation(article) {
  const speculationPatterns = [
    /(?:と思われる|はずだ|だろう|であろう|に違いない|かもしれない)(?=.*(?:\d+|cc|rpm|ps|nm|kg|mm|km))/g,
    /おそらく.*(?:\d+|cc|rpm|ps|nm|kg|mm|km)/g,
    /推測.*(?:\d+|cc|rpm|ps|nm|kg|mm|km)/g,
    /(?:前モデル|旧型|従来型)と同(?:じ|様).*(?:\d+|cc|rpm|ps|nm|kg|mm|km)/g,
  ];

  const articleText = JSON.stringify(article.sections);

  for (const pattern of speculationPatterns) {
    const match = articleText.match(pattern);
    if (match) {
      return {
        pass: false,
        reason: `スペック推測を検出: 「${match[0].slice(0, 30)}」`,
      };
    }
  }
  return { pass: true };
}

// 3. 過剰断定チェック
function checkOverAssertion(article) {
  const assertionPatterns = [
    /(?:最高|最強|最速|最安|世界一|日本一|ナンバーワン|No\.1)(?:の|な|だ|です)/g,
    /絶対(?:に)?(?:買|乗|おすすめ|必要)/g,
    /必ず(?:買|乗|おすすめ)/g,
  ];

  const articleText = JSON.stringify(article.sections);

  for (const pattern of assertionPatterns) {
    const match = articleText.match(pattern);
    if (match) {
      return {
        pass: false,
        reason: `過剰断定表現を検出: 「${match[0]}」`,
      };
    }
  }
  return { pass: true };
}

// 4. 引用元セクションチェック
function checkSourceSection(article) {
  const sections = article.sections || [];
  const hasSource = sections.some(
    s => s.link_type === 'external' && s.link_id
  );
  if (!hasSource) {
    return { pass: false, reason: '引用元sectionが存在しない' };
  }
  return { pass: true };
}

// 5. 独自性チェック（解釈ゼロ検出）
function checkOriginality(article) {
  const sections = article.sections || [];
  // 引用元以外のsectionsを対象
  const contentSections = sections.filter(s => s.link_type !== 'external');
  const allText = contentSections.map(s => s.body).join('');

  // 解釈・視点を示すキーワードが1つもない場合はFail
  const interpretationKeywords = [
    'ライダー', 'ツーリング', '走り', '感じ', '気になる', '注目',
    '影響', '変わる', '期待', '意味', '視点', 'にとって',
    'かもしれない', 'だろう', 'ではないか',
  ];

  const hasInterpretation = interpretationKeywords.some(kw => allText.includes(kw));
  if (!hasInterpretation) {
    return {
      pass: false,
      reason: 'RIDOとしての解釈・ライダー視点が不足している',
    };
  }
  return { pass: true };
}

// ============================================
// メイン実行
// ============================================
export async function runLegalChecker(briefingWeek) {
  console.log('[legal_checker] 開始');

  // approvedかつbike_newsの記事を取得
  const { data: articles, error } = await supabase
    .from('news_articles')
    .select('*, news_raw(*)')
    .eq('status', 'approved')
    .eq('tab', 'bike_news')
    .eq('briefing_week', briefingWeek)
    .eq('layer1_result', 'pass')  // quality_checker通過済み・legal未チェック
    .limit(50);

  if (error) throw error;
  console.log(`[legal_checker] 判定対象: ${articles?.length || 0}件`);

  let passed = 0;
  let failed = 0;

  for (const article of articles || []) {
    const raw = article.news_raw;
    const checks = [
      checkTextSimilarity(article, raw),
      checkSpeculation(article),
      checkOverAssertion(article),
      checkSourceSection(article),
      checkOriginality(article),
    ];

    const failedCheck = checks.find(c => !c.pass);

    if (failedCheck) {
      console.log(`[legal_checker] Fail: ${article.title?.slice(0, 30)} - ${failedCheck.reason}`);

      // retry_countを確認（最大2回）
      const retryCount = article.metadata?.retry_count || 0;

      if (retryCount < 2) {
        // 再生成依頼
        await supabase.from('news_articles').update({
          status: 'pending',
          layer1_result: `legal_retry_${retryCount + 1}`,
          metadata: { retry_count: retryCount + 1, last_fail_reason: failedCheck.reason },
        }).eq('id', article.id);

        console.log(`[legal_checker] 再生成依頼 (${retryCount + 1}/2回目)`);
      } else {
        // 2回失敗 → pending_review
        await supabase.from('news_articles').update({
          status: 'pending_review',
          layer1_result: `legal_failed: ${failedCheck.reason}`,
        }).eq('id', article.id);

        await notifyLayer1(article.title, failedCheck.reason, article.source_url);
      }
      failed++;
    } else {
      // 通過 → legal_passedフラグを立てる
      await supabase.from('news_articles').update({
        layer1_result: 'legal_passed',
      }).eq('id', article.id);
      passed++;
    }
  }

  console.log(`[legal_checker] 完了: 通過${passed}件 / Fail${failed}件`);
  return { passed, failed };
}
