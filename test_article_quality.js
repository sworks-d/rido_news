// test_article_quality.js
// Supabaseなしで全3カテゴリの記事生成クオリティを確認する
// 実行方法: node test_article_quality.js

import { config } from 'dotenv';
config();

// ============================================
// テスト素材
// ============================================

const TEST_BIKE_NEWS_JA = {
  title: 'カワサキ、新型Z900RS 2026年モデルを発表',
  body: 'カワサキは2026年モデルのZ900RSを発表した。エンジンと電子制御システムが刷新され、トラクションコントロールの精度が向上している。カラーバリエーションは3色展開で、価格は152万9000円。2026年2月14日発売予定。試乗した開発担当者によると「Z900RSの魅力であるクラシックなスタイルを維持しながら、現代的な走りを実現した」とのこと。',
  source_name: 'バイクブロスマガジンズ',
  source_lang: 'ja',
  jp_relevance: 'high',
};

const TEST_BIKE_NEWS_EN = {
  title: 'Ducati unveils new Panigale V4 Centennial Edition for 2026',
  body: 'Ducati has revealed a special Centennial Edition of the Panigale V4 to celebrate the brand\'s 100th anniversary. The limited edition features a unique livery inspired by the original 1926 Ducati, along with upgraded Ohlins suspension and titanium exhaust. Only 100 units will be produced worldwide, with pricing starting at $45,000. Available exclusively in the US and European markets.',
  source_name: 'Total Motorcycle',
  source_lang: 'en',
  jp_relevance: 'low',
};

const TEST_ROUTE = {
  title: '奥三河から天竜川沿いを走る日帰りルート',
  distance_km: 185,
  prefecture: '愛知県・静岡県',
  area: 'tokai',
  tags: ['ワインディング', '絶景', '温泉'],
  season: '春',
  quoted_comments: [
    '峠を越えたところで視界が開けて、遠くに南アルプスが見えた。あの瞬間のために走ってる気がする。',
    '天竜川沿いの道は信号が少なくてずっと流せる。帰りに寄った温泉も最高だった。',
  ],
};

const TEST_SPOT = {
  title: '茶臼山高原',
  category: '絶景',
  area: 'tokai',
  prefecture: '愛知県',
  tags: ['絶景', '高原', '春'],
  description: '標高1415mの高原で、晴れた日には南アルプスまで見渡せる。4月下旬から5月初旬は芝桜が満開になって、バイクを停めてぼーっとしてしまう。駐車場は広くてライダーが多い。',
};

// ============================================
// 記事生成
// ============================================

async function callAPI(prompt) {
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
  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  const text = data.content[0]?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function genBikeNews(raw) {
  const jpNote = raw.jp_relevance === 'low'
    ? '\n※日本未発売の可能性あり。sectionsの末尾に{"heading":"日本での発売について","body":"この情報は海外向けの発表です。日本での発売・仕様・価格は未確定の場合があります。国内情報が入り次第、改めてお伝えします。","quoted_comment":null}を追加してください。'
    : '';

  return callAPI(`あなたはRIDOというバイクアプリのニュース記事ライターです。

## トーン（フラット50% / 俺50%）
- 断定しない・ランキングしない・命令調禁止・感嘆符2個以内

## 素材
タイトル：${raw.title}
本文：${raw.body}
ソース：${raw.source_name}
言語：${raw.source_lang === 'en' ? '英語→日本語に自然に変換' : '日本語'}${jpNote}

## 出力（JSONのみ）
{"title":"30字以内","summary":"100字以内","index":["15字以内","15字以内","15字以内"],"sections":[{"heading":"h","body":"200字以内","quoted_comment":null},{"heading":"h","body":"200字以内","quoted_comment":null},{"heading":"h","body":"200字以内","quoted_comment":null}],"tags":["t1","t2","t3"],"tone_score":4,"tone_notes":""}`);
}

async function genRoute(raw) {
  return callAPI(`あなたはRIDOというバイクアプリのルート特集ライターです。

## トーン（フラット15% / 俺85%・体験ドリブン）
- 断定しない・ランキングしない・命令調禁止・感嘆符2個以内
- ライダーのコメントは一字一句改変しない

## ルートデータ
タイトル：${raw.title} / 距離：${raw.distance_km}km / エリア：${raw.prefecture}
タグ：${raw.tags.join(', ')} / 季節：${raw.season}
ライダーのコメント（引用必須）：
1. "${raw.quoted_comments[0]}"
2. "${raw.quoted_comments[1]}"

## 出力（JSONのみ）
{"title":"30字以内","summary":"120字以内","index":["このルートについて","立ち寄りスポット","走ってみた感想"],"sections":[{"heading":"このルートについて","body":"200字以内","quoted_comment":null},{"heading":"立ち寄りスポット","body":"200字以内","quoted_comment":"コメント1をそのまま"},{"heading":"走ってみた感想","body":"200字以内","quoted_comment":"コメント2をそのまま"}],"tags":["t1","t2","t3"],"selected_theme":"テーマ名","tone_score":4,"tone_notes":""}`);
}

async function genSpot(raw) {
  return callAPI(`あなたはRIDOというバイクアプリのスポット特集ライターです。

## トーン（フラット15% / 俺85%・体験ドリブン）
- 断定しない・ランキングしない・命令調禁止・感嘆符2個以内
- ライダーの説明文は一字一句改変しない

## スポットデータ
名前：${raw.title} / カテゴリ：${raw.category} / エリア：${raw.area}（${raw.prefecture}）
タグ：${raw.tags.join(', ')}
ライダーが書いた説明文（引用必須・改変禁止）：
"${raw.description}"

## 出力（JSONのみ）
{"title":"30字以内","summary":"120字以内","index":["このスポットについて","ここが良かった","行くときのポイント"],"sections":[{"heading":"このスポットについて","body":"200字以内","quoted_comment":null},{"heading":"ここが良かった","body":"200字以内","quoted_comment":"説明文をそのまま"},{"heading":"行くときのポイント","body":"200字以内","quoted_comment":null}],"tags":["t1","t2","t3"],"selected_theme":"テーマ名","tone_score":4,"tone_notes":""}`);
}

// ============================================
// 表示
// ============================================
function printArticle(label, article) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`【${label}】`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`■ タイトル：${article.title}`);
  console.log(`■ 概要：${article.summary}`);
  console.log(`■ トーンスコア：${article.tone_score} / 5`);
  if (article.tone_notes) console.log(`■ トーンメモ：${article.tone_notes}`);
  if (article.selected_theme) console.log(`■ テーマ：${article.selected_theme}`);
  console.log(`■ タグ：${article.tags?.join(' / ')}`);
  console.log('');
  article.sections?.forEach((s, i) => {
    console.log(`[${i+1}] ${s.heading}`);
    console.log(`    ${s.body}`);
    if (s.quoted_comment) {
      console.log(`    ▶ 引用：「${s.quoted_comment}」`);
    }
    console.log('');
  });
}

// ============================================
// メイン
// ============================================
async function main() {
  console.log('=== RIDO 記事クオリティ確認 ===');
  console.log('全3カテゴリ × 計4記事を生成します\n');

  // バイクニュース（日本語）
  console.log('生成中: バイクニュース（日本語）...');
  try {
    const r1 = await genBikeNews(TEST_BIKE_NEWS_JA);
    printArticle('バイクニュース・日本語', r1);
  } catch (e) { console.error('❌ 失敗:', e.message); }

  // バイクニュース（英語・jp_relevance=low）
  console.log('生成中: バイクニュース（英語→日本語・海外情報）...');
  try {
    const r2 = await genBikeNews(TEST_BIKE_NEWS_EN);
    printArticle('バイクニュース・英語→日本語（海外情報注記あり）', r2);
    const hasNote = r2.sections?.some(s => s.heading?.includes('日本'));
    console.log(`  ✅ 日本未発売注記: ${hasNote ? 'あり' : '❌ なし'}`);
  } catch (e) { console.error('❌ 失敗:', e.message); }

  // ルート特集
  console.log('\n生成中: ルート特集...');
  try {
    const r3 = await genRoute(TEST_ROUTE);
    printArticle('ルート特集', r3);
    const hasQuote = r3.sections?.some(s => s.quoted_comment);
    console.log(`  ✅ ライダーコメント引用: ${hasQuote ? 'あり' : '❌ なし'}`);
  } catch (e) { console.error('❌ 失敗:', e.message); }

  // スポット特集
  console.log('\n生成中: スポット特集...');
  try {
    const r4 = await genSpot(TEST_SPOT);
    printArticle('スポット特集', r4);
    const hasQuote = r4.sections?.some(s => s.quoted_comment);
    console.log(`  ✅ 説明文引用: ${hasQuote ? 'あり' : '❌ なし'}`);
  } catch (e) { console.error('❌ 失敗:', e.message); }

  console.log('\n=== 完了 ===');
}

main();
