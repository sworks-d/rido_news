// test_article_quality_html.js
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
config();

const TEST_BIKE_NEWS_JA = {
  label: 'バイクニュース（日本語）',
  title: 'カワサキ、新型Z900RS 2026年モデルを発表',
  body: 'カワサキは2026年モデルのZ900RSを発表した。エンジンと電子制御システムが刷新され、トラクションコントロールの精度が向上している。カラーバリエーションは3色展開で、価格は152万9000円。2026年2月14日発売予定。',
  source_name: 'バイクブロスマガジンズ', source_lang: 'ja', jp_relevance: 'high',
};

const TEST_BIKE_NEWS_EN = {
  label: 'バイクニュース（英語→日本語・海外情報）',
  title: 'Ducati unveils new Panigale V4 Centennial Edition for 2026',
  body: "Ducati has revealed a special Centennial Edition of the Panigale V4. Only 100 units worldwide, priced at $45,000. Available exclusively in the US and European markets.",
  source_name: 'Total Motorcycle', source_lang: 'en', jp_relevance: 'low',
};

const TEST_SPOTS = {
  label: 'スポット特集（まとめ）',
  area: '東海',
  spots: [
    { spot_id: 'spot-001', name: '茶臼山高原', category: '絶景', prefecture: '愛知県', description: '標高1415mの高原で、晴れた日には南アルプスまで見渡せる。4月下旬から5月初旬は芝桜が満開になって、バイクを停めてぼーっとしてしまう。' },
    { spot_id: 'spot-002', name: '鳳来寺山', category: '歴史的建造物', prefecture: '愛知県', description: '長い石段を登った先に古い社がある。ヘルメットを持ちながら登るのがちょっとしんどいけど、上からの眺めは格別だった。' },
    { spot_id: 'spot-003', name: '道の駅 したら', category: '道の駅', prefecture: '愛知県', description: '設楽ダムの近くにある道の駅。奥三河の特産品が揃ってて、ソフトクリームが絶品。ライダーが多くて駐輪場も広い。' },
  ],
};

const TEST_ROUTES = {
  label: 'ルート特集（まとめ）',
  routes: [
    { route_id: 'route-001', title: '奥三河から天竜川沿いルート', distance_km: 185, prefecture: '愛知県・静岡県', tags: ['ワインディング','絶景','温泉'], quoted_comments: ['峠を越えたところで視界が開けて、南アルプスが見えた。あの瞬間のために走ってる気がする。'] },
    { route_id: 'route-002', title: '伊勢志摩一周ルート', distance_km: 210, prefecture: '三重県', tags: ['海沿い','絶景','道の駅'], quoted_comments: ['海岸線をずっと走れるのが気持ちいい。牡蠣小屋に寄ったのも最高だった。'] },
    { route_id: 'route-003', title: '岐阜・飛騨古川ルート', distance_km: 156, prefecture: '岐阜県', tags: ['歴史','山岳','日帰り'], quoted_comments: ['白川郷の手前の道が特に良かった。観光客が少ない早朝に走るのがおすすめ。'] },
  ],
};

async function callAPI(prompt, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return JSON.parse((data.content[0]?.text || '').replace(/```json|```/g, '').trim());
}

async function genBikeNews(raw) {
  const jpNote = raw.jp_relevance === 'low'
    ? '\n※日本未発売の可能性あり。sectionsの末尾に{"heading":"日本での発売について","body":"この情報は海外向けの発表です。日本での発売・仕様・価格は未確定の場合があります。","quoted_comment":null,"link_type":null,"link_id":null}を追加。'
    : '';
  return callAPI(`あなたはRIDOというバイクアプリのニュース記事ライターです。
トーン：断定しない・ランキングしない・命令調禁止・感嘆符2個以内
素材タイトル：${raw.title}
本文：${raw.body}
言語：${raw.source_lang === 'en' ? '英語→日本語に自然に変換' : '日本語'}${jpNote}
JSONのみ出力：{"title":"30字以内","summary":"100字以内","index":["h1","h2","h3"],"sections":[{"heading":"h","body":"200字以内","quoted_comment":null,"link_type":null,"link_id":null},{"heading":"h","body":"200字以内","quoted_comment":null,"link_type":null,"link_id":null},{"heading":"h","body":"200字以内","quoted_comment":null,"link_type":null,"link_id":null}],"tags":["t1","t2","t3"],"tone_score":4,"tone_notes":""}`);
}

async function genSpots(data) {
  const spotList = data.spots.map((s, i) =>
    `${i+1}. 【${s.name}】${s.category} / ${s.prefecture}\n   説明文:"${s.description}"`
  ).join('\n');
  return callAPI(`あなたはRIDOバイクアプリのスポット特集ライターです。
トーン：各スポット60〜80字・詳細はアプリで・ライダーの説明文は改変禁止・命令調禁止
エリア：${data.area}
スポット一覧：
${spotList}
JSONのみ出力：{"title":"今週の${data.area}おすすめスポット（30字以内）","summary":"100字以内のリード文","index":${JSON.stringify(data.spots.map(s=>s.name))},"sections":[${data.spots.map(s=>`{"heading":"${s.name}","body":"60〜80字の紹介","quoted_comment":"${s.description.replace(/"/g,'\\"').slice(0,80)}","link_type":"spot","link_id":"${s.spot_id}"}`).join(',')}],"tags":["${data.area}","絶景","ツーリング"],"selected_theme":"エリア特集","tone_score":4,"tone_notes":""}`);
}

async function genRoutes(data) {
  const routeList = data.routes.map((r, i) =>
    `${i+1}. 【${r.title}】${r.distance_km}km / ${r.prefecture}\n   コメント:"${r.quoted_comments[0]}"`
  ).join('\n');
  return callAPI(`あなたはRIDOバイクアプリのルート特集ライターです。
トーン：各ルート60〜80字・詳細はアプリで・ライダーのコメントは改変禁止・命令調禁止
今週のルート一覧：
${routeList}
JSONのみ出力：{"title":"今週走られているルート（30字以内）","summary":"100字以内のリード文","index":${JSON.stringify(data.routes.map(r=>r.title.slice(0,12)))},"sections":[${data.routes.map(r=>`{"heading":"${r.title.replace(/"/g,'\\"')}","body":"60〜80字の紹介","quoted_comment":"${r.quoted_comments[0].replace(/"/g,'\\"').slice(0,80)}","link_type":"route","link_id":"${r.route_id}"}`).join(',')}],"tags":["ツーリング","春","東海"],"selected_theme":"今週のルート","tone_score":4,"tone_notes":""}`);
}

function renderCard(label, article) {
  const sections = (article.sections||[]).map(s => `
    <div class="section">
      <div class="s-heading">${s.heading}</div>
      <div class="s-body">${s.body}</div>
      ${s.quoted_comment ? `<div class="quote">▶ 「${s.quoted_comment}」</div>` : ''}
      ${s.link_type ? `<div class="link-badge">${s.link_type === 'spot' ? '📍' : '🗺️'} アプリで見る → ${s.link_type}/${s.link_id}</div>` : ''}
    </div>`).join('');

  const tags = (article.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('');
  const tc = article.tone_score >= 4 ? '#52c97a' : article.tone_score >= 3 ? '#e8a842' : '#e85c4a';

  return `<div class="card">
    <div class="card-header">
      <span class="card-label">${label}</span>
      <span class="tone-badge" style="background:${tc}">トーン ${article.tone_score}/5</span>
    </div>
    <div class="card-title">${article.title}</div>
    <div class="card-summary">${article.summary}</div>
    ${article.selected_theme ? `<div class="theme">🎯 ${article.selected_theme}</div>` : ''}
    <div class="tags">${tags}</div>
    <div class="index-box"><span class="index-label">目次</span> ${(article.index||[]).join(' / ')}</div>
    <div class="sections">${sections}</div>
    ${article.tone_notes ? `<div class="tone-notes">📝 ${article.tone_notes}</div>` : ''}
  </div>`;
}

async function main() {
  console.log('記事生成中...');
  const cards = [];
  const gen = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  for (const [i, task] of [
    ['1/4', 'バイクニュース（日本語）', () => genBikeNews(TEST_BIKE_NEWS_JA), TEST_BIKE_NEWS_JA.label],
    ['2/4', 'バイクニュース（英語）', () => genBikeNews(TEST_BIKE_NEWS_EN), TEST_BIKE_NEWS_EN.label],
    ['3/4', 'スポット特集（まとめ）', () => genSpots(TEST_SPOTS), TEST_SPOTS.label],
    ['4/4', 'ルート特集（まとめ）', () => genRoutes(TEST_ROUTES), TEST_ROUTES.label],
  ].entries()) {
    console.log(`[${task[0]}] ${task[1]}...`);
    try {
      const result = await task[2]();
      cards.push(renderCard(task[3], result));
    } catch(e) { console.error('❌', e.message); cards.push(`<div class="card error">❌ ${task[1]}: ${e.message}</div>`); }
  }

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIDO 記事クオリティ確認</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f0f10;color:#e8e6e0;font-family:-apple-system,'Helvetica Neue',sans-serif;font-size:14px;line-height:1.7;padding:32px 16px 64px}
.header{margin-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:16px}
.header h1{font-size:20px;font-weight:600;color:#fff;margin-bottom:4px}
.header p{color:#5a5855;font-size:11px;font-family:monospace}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:20px}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
.card{background:#17171a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:22px}
.card.error{color:#e85c4a;font-family:monospace;font-size:12px}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.card-label{font-size:10px;font-family:monospace;color:#2ec4a4;letter-spacing:.1em;text-transform:uppercase}
.tone-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;color:#0f0f10}
.card-title{font-size:17px;font-weight:700;color:#fff;margin-bottom:8px;line-height:1.4}
.card-summary{color:#8f8d87;font-size:13px;margin-bottom:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid rgba(46,196,164,0.4)}
.theme{font-size:11px;color:#e8a842;margin-bottom:8px;font-family:monospace}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
.tag{font-size:11px;padding:2px 7px;border-radius:4px;background:rgba(124,106,247,0.12);border:1px solid rgba(124,106,247,0.25);color:#7c6af7}
.index-box{font-size:11px;color:#5a5855;margin-bottom:14px;font-family:monospace}
.index-label{color:#4a9ef8}
.sections{border-top:1px solid rgba(255,255,255,0.06);padding-top:14px}
.section{margin-bottom:14px}
.s-heading{font-size:12px;font-weight:600;color:#4a9ef8;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em}
.s-body{font-size:13px;color:#c8c6c0;line-height:1.8}
.quote{margin-top:6px;padding:8px 12px;background:rgba(232,168,66,0.06);border:1px solid rgba(232,168,66,0.2);border-radius:6px;font-size:12px;color:#e8a842;font-style:italic}
.link-badge{margin-top:6px;font-size:11px;color:#52c97a;font-family:monospace;padding:4px 8px;background:rgba(82,201,122,0.06);border:1px solid rgba(82,201,122,0.2);border-radius:4px;display:inline-block}
.tone-notes{margin-top:10px;font-size:11px;color:#5a5855;font-family:monospace}
</style></head><body>
<div class="header"><h1>RIDO 記事クオリティ確認</h1><p>生成日時: ${gen} / model: claude-haiku-4-5</p></div>
<div class="grid">${cards.join('\n')}</div>
</body></html>`;

  const path = '/Users/a05/rido_news/article_quality_report.html';
  writeFileSync(path, html, 'utf-8');
  console.log(`\n✅ 完了: ${path}`);
  console.log(`open ${path}`);
}

main();
