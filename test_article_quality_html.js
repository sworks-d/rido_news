// test_article_quality_html.js
// 記事生成結果をHTMLファイルに出力してブラウザで確認する
// 実行方法: node test_article_quality_html.js

import { config } from 'dotenv';
import { writeFileSync } from 'fs';
config();

const TEST_BIKE_NEWS_JA = {
  label: 'バイクニュース（日本語）',
  title: 'カワサキ、新型Z900RS 2026年モデルを発表',
  body: 'カワサキは2026年モデルのZ900RSを発表した。エンジンと電子制御システムが刷新され、トラクションコントロールの精度が向上している。カラーバリエーションは3色展開で、価格は152万9000円。2026年2月14日発売予定。試乗した開発担当者によると「Z900RSの魅力であるクラシックなスタイルを維持しながら、現代的な走りを実現した」とのこと。',
  source_name: 'バイクブロスマガジンズ',
  source_lang: 'ja',
  jp_relevance: 'high',
};

const TEST_BIKE_NEWS_EN = {
  label: 'バイクニュース（英語→日本語・海外情報）',
  title: 'Ducati unveils new Panigale V4 Centennial Edition for 2026',
  body: "Ducati has revealed a special Centennial Edition of the Panigale V4 to celebrate the brand's 100th anniversary. The limited edition features a unique livery inspired by the original 1926 Ducati, along with upgraded Ohlins suspension and titanium exhaust. Only 100 units will be produced worldwide, with pricing starting at $45,000. Available exclusively in the US and European markets.",
  source_name: 'Total Motorcycle',
  source_lang: 'en',
  jp_relevance: 'low',
};

const TEST_ROUTE = {
  label: 'ルート特集',
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
  label: 'スポット特集',
  title: '茶臼山高原',
  category: '絶景',
  area: 'tokai',
  prefecture: '愛知県',
  tags: ['絶景', '高原', '春'],
  description: '標高1415mの高原で、晴れた日には南アルプスまで見渡せる。4月下旬から5月初旬は芝桜が満開になって、バイクを停めてぼーっとしてしまう。駐車場は広くてライダーが多い。',
};

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
断定しない・ランキングしない・命令調禁止・感嘆符2個以内
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
断定しない・ランキングしない・命令調禁止・ライダーのコメントは一字一句改変しない
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
断定しない・ランキングしない・命令調禁止・ライダーの説明文は一字一句改変しない
## スポットデータ
名前：${raw.title} / カテゴリ：${raw.category} / エリア：${raw.area}（${raw.prefecture}）
タグ：${raw.tags.join(', ')}
ライダーが書いた説明文（引用必須・改変禁止）："${raw.description}"
## 出力（JSONのみ）
{"title":"30字以内","summary":"120字以内","index":["このスポットについて","ここが良かった","行くときのポイント"],"sections":[{"heading":"このスポットについて","body":"200字以内","quoted_comment":null},{"heading":"ここが良かった","body":"200字以内","quoted_comment":"説明文をそのまま"},{"heading":"行くときのポイント","body":"200字以内","quoted_comment":null}],"tags":["t1","t2","t3"],"selected_theme":"テーマ名","tone_score":4,"tone_notes":""}`);
}

function toneColor(score) {
  if (score >= 4) return '#52c97a';
  if (score >= 3) return '#e8a842';
  return '#e85c4a';
}

function renderArticleCard(label, article, meta = {}) {
  const sections = (article.sections || []).map(s => `
    <div class="section">
      <div class="section-heading">${s.heading}</div>
      <div class="section-body">${s.body}</div>
      ${s.quoted_comment ? `<div class="quote">「${s.quoted_comment}」</div>` : ''}
    </div>`).join('');

  const tags = (article.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  const index = (article.index || []).map(i => `<li>${i}</li>`).join('');
  const checks = Object.entries(meta).map(([k, v]) =>
    `<div class="check ${v ? 'ok' : 'ng'}">${v ? '✅' : '❌'} ${k}</div>`
  ).join('');

  return `
  <div class="card">
    <div class="card-header">
      <div class="card-label">${label}</div>
      <div class="tone-badge" style="background:${toneColor(article.tone_score)}">
        トーン ${article.tone_score}/5
      </div>
    </div>
    <div class="card-title">${article.title}</div>
    <div class="card-summary">${article.summary}</div>
    ${article.selected_theme ? `<div class="theme">テーマ：${article.selected_theme}</div>` : ''}
    <div class="tags">${tags}</div>
    <div class="index-section">
      <div class="index-label">目次</div>
      <ol>${index}</ol>
    </div>
    <div class="sections">${sections}</div>
    ${article.tone_notes ? `<div class="tone-notes">📝 ${article.tone_notes}</div>` : ''}
    ${checks ? `<div class="checks">${checks}</div>` : ''}
  </div>`;
}

function buildHTML(cards, generatedAt) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RIDO 記事クオリティ確認</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0f0f10; color: #e8e6e0; font-family: -apple-system,'Helvetica Neue',sans-serif; font-size: 14px; line-height: 1.7; padding: 32px 16px 64px; }
.header { margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; }
.header h1 { font-size: 22px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.header p { color: #5a5855; font-size: 12px; font-family: 'DM Mono', monospace; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 20px; }
@media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
.card { background: #17171a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-label { font-size: 10px; font-family: monospace; color: #2ec4a4; letter-spacing: 0.1em; text-transform: uppercase; }
.tone-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; color: #0f0f10; }
.card-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 10px; line-height: 1.4; }
.card-summary { color: #8f8d87; font-size: 13px; margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 3px solid rgba(46,196,164,0.4); }
.theme { font-size: 11px; color: #e8a842; margin-bottom: 10px; font-family: monospace; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(124,106,247,0.12); border: 1px solid rgba(124,106,247,0.25); color: #7c6af7; }
.index-section { margin-bottom: 16px; }
.index-label { font-size: 10px; color: #5a5855; font-family: monospace; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
.index-section ol { padding-left: 18px; color: #8f8d87; font-size: 12px; }
.index-section li { margin-bottom: 3px; }
.sections { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
.section { margin-bottom: 16px; }
.section-heading { font-size: 12px; font-weight: 600; color: #4a9ef8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.section-body { font-size: 13px; color: #c8c6c0; line-height: 1.8; }
.quote { margin-top: 8px; padding: 10px 14px; background: rgba(232,168,66,0.06); border: 1px solid rgba(232,168,66,0.2); border-radius: 6px; font-size: 12px; color: #e8a842; font-style: italic; }
.tone-notes { margin-top: 12px; font-size: 11px; color: #5a5855; font-family: monospace; }
.checks { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); }
.check { font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.04); }
.check.ok { color: #52c97a; }
.check.ng { color: #e85c4a; }
</style>
</head>
<body>
<div class="header">
  <h1>RIDO 記事クオリティ確認</h1>
  <p>生成日時: ${generatedAt} / model: claude-haiku-4-5</p>
</div>
<div class="grid">
${cards.join('\n')}
</div>
</body>
</html>`;
}

async function main() {
  console.log('記事を生成中...');
  const cards = [];
  const generatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  console.log('[1/4] バイクニュース（日本語）');
  try {
    const r = await genBikeNews(TEST_BIKE_NEWS_JA);
    cards.push(renderArticleCard(TEST_BIKE_NEWS_JA.label, r));
  } catch (e) { console.error('❌', e.message); }

  console.log('[2/4] バイクニュース（英語→日本語）');
  try {
    const r = await genBikeNews(TEST_BIKE_NEWS_EN);
    const hasNote = r.sections?.some(s => s.heading?.includes('日本'));
    cards.push(renderArticleCard(TEST_BIKE_NEWS_EN.label, r, { '日本未発売注記': hasNote }));
  } catch (e) { console.error('❌', e.message); }

  console.log('[3/4] ルート特集');
  try {
    const r = await genRoute(TEST_ROUTE);
    const hasQuote = r.sections?.some(s => s.quoted_comment);
    cards.push(renderArticleCard(TEST_ROUTE.label, r, { 'ライダーコメント引用': hasQuote }));
  } catch (e) { console.error('❌', e.message); }

  console.log('[4/4] スポット特集');
  try {
    const r = await genSpot(TEST_SPOT);
    const hasQuote = r.sections?.some(s => s.quoted_comment);
    cards.push(renderArticleCard(TEST_SPOT.label, r, { '説明文引用': hasQuote }));
  } catch (e) { console.error('❌', e.message); }

  const html = buildHTML(cards, generatedAt);
  const outPath = '/Users/a05/rido_news/article_quality_report.html';
  writeFileSync(outPath, html, 'utf-8');

  console.log(`\n✅ 完了: ${outPath}`);
  console.log('ブラウザで開いてください:');
  console.log(`open ${outPath}`);
}

main();
