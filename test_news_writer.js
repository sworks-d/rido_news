// test_news_writer.js
// Supabaseなしでnews_writerの記事生成だけを確認する
// 実行方法: node test_news_writer.js

import { config } from 'dotenv';
config();

const TEST_ARTICLE = {
  title: 'カワサキ、新型Z900RS 2026年モデルを発表',
  body: 'カワサキは2026年モデルのZ900RSを発表した。エンジンと電子制御システムが刷新され、トラクションコントロールの精度が向上している。カラーバリエーションは3色展開で、価格は152万9000円。2026年2月14日発売予定。',
  source_name: 'バイクブロスマガジンズ',
  source_url: 'https://news.bikebros.co.jp/xxx',
  source_lang: 'ja',
  jp_relevance: 'high',
  trust_score: 85,
  source_type: 'external_rss',
};

const TEST_ARTICLE_EN = {
  title: 'Ducati announces new Panigale V4 for 2026',
  body: 'Ducati has unveiled the new Panigale V4 for 2026, featuring a revised 1103cc engine with increased power output. The new model includes updated aerodynamics and improved electronics package. Available in three colors starting at $28,995. US release scheduled for March 2026.',
  source_name: 'Total Motorcycle',
  source_url: 'https://www.totalmotorcycle.com/xxx',
  source_lang: 'en',
  jp_relevance: 'low',
  trust_score: 82,
  source_type: 'external_rss',
};

async function generateArticle(raw) {
  const isEnglish = raw.source_lang === 'en';
  const jpNote = raw.jp_relevance === 'low'
    ? '\n\n【重要】日本未発売の可能性あり。sectionsの末尾に{"heading":"日本での発売について","body":"この情報は海外向けの発表です。日本での発売・仕様・価格は未確定の場合があります。国内情報が入り次第、改めてお伝えします。","quoted_comment":null}を必ず追加してください。'
    : '';

  const prompt = `あなたはRIDOというバイクアプリのニュース記事ライターです。

## トーン設定
- 断定しない。可能性を示す。
- ランキングしない。優劣をつけない。
- 承認欲求を煽らない。
- 命令調禁止：「〜してください」→「〜するといい」
- 感嘆符は1記事2個以内

## 素材
タイトル：${raw.title}
本文：${raw.body}
ソース：${raw.source_name}
言語：${isEnglish ? '英語（日本語で自然に生成すること）' : '日本語'}${jpNote}

## 出力形式（JSONのみ・前後テキスト不要）
{
  "title": "見出し（30字以内）",
  "summary": "概要（100字以内）",
  "index": ["ポイント1（15字以内）","ポイント2（15字以内）","ポイント3（15字以内）"],
  "sections": [
    {"heading":"ポイント1","body":"段落テキスト（200字以内）","quoted_comment":null},
    {"heading":"ポイント2","body":"段落テキスト（200字以内）","quoted_comment":null},
    {"heading":"ポイント3","body":"段落テキスト（200字以内）","quoted_comment":null}
  ],
  "tags": ["タグ1","タグ2","タグ3"],
  "tone_score": 4,
  "tone_notes": "修正内容があれば記載"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function main() {
  console.log('=== RIDO News Writer 動作確認 ===\n');

  // テスト1: 日本語記事
  console.log('--- テスト1: 日本語記事 ---');
  console.log(`素材: ${TEST_ARTICLE.title}\n`);
  try {
    const result1 = await generateArticle(TEST_ARTICLE);
    console.log('✅ 生成成功');
    console.log(`タイトル: ${result1.title}`);
    console.log(`概要: ${result1.summary}`);
    console.log(`トーンスコア: ${result1.tone_score}`);
    console.log(`タグ: ${result1.tags?.join(', ')}`);
    console.log('');
  } catch (err) {
    console.error('❌ 失敗:', err.message);
  }

  // テスト2: 英語記事（日本未発売注記あり）
  console.log('--- テスト2: 英語記事（jp_relevance=low）---');
  console.log(`素材: ${TEST_ARTICLE_EN.title}\n`);
  try {
    const result2 = await generateArticle(TEST_ARTICLE_EN);
    console.log('✅ 生成成功');
    console.log(`タイトル: ${result2.title}`);
    console.log(`概要: ${result2.summary}`);
    console.log(`セクション数: ${result2.sections?.length}`);
    const hasJpNote = result2.sections?.some(s => s.heading?.includes('日本'));
    console.log(`日本未発売注記: ${hasJpNote ? '✅ あり' : '❌ なし'}`);
    console.log(`トーンスコア: ${result2.tone_score}`);
    console.log('');
  } catch (err) {
    console.error('❌ 失敗:', err.message);
  }

  console.log('=== 確認完了 ===');
}

main();
