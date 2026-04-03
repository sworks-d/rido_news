# rss_sources.md

## RSSソース定義

収集パイロット（rss_collector）が参照するソースリスト。
ここにないソースからは収集しない。

優先順位：メーカー公式 > バイク系メディア（日本語）> バイク系メディア（英語）> プレスリリース

---

## 信頼スコアの定義

| スコア | 基準 |
|---|---|
| 90〜100 | メーカー公式・業界公式 |
| 80〜89 | 主要バイク専門メディア |
| 70〜79 | バイク系ニュースサイト |
| 70未満 | 収集対象外 |

---

## 1. メーカー公式（trust_score: 95）

| メーカー | RSS URL | 疎通 | 言語 |
|---|---|---|---|
| Kawasaki | https://www.kawasaki-motors.com/ja/news/rss/ | ✅ | 日本語 |
| Suzuki | https://www1.suzuki.co.jp/motor/rss/news.xml | ✅ | 日本語 |

※Honda・Yamaha・海外メーカー日本語サイトはRSS未提供または404。
　下記英語メディアで補完する。

---

## 2. バイク系メディア（日本語）（trust_score: 85）

| メディア | RSS URL | 疎通 | 特徴 |
|---|---|---|---|
| Webikeプラス | https://news.webike.net/feed/ | ✅ | 国内最大級・新車・用品 |
| モーサイ | https://mc-web.jp/feed/ | ✅ | 老舗・信頼性高い |
| バイクブロスマガジンズ | https://news.bikebros.co.jp/feed/ | ✅ | 新型情報・試乗レポート |

---

## 3. バイク系メディア（英語）（trust_score: 82）

海外メーカー（Ducati・BMW・Triumph・KTM・Aprilia・Harley等）の
情報を網羅するために追加する。
英語記事はnews_writerが日本語に翻訳して配信する。

| メディア | RSS URL | 疎通 | 特徴 |
|---|---|---|---|
| Motorcycle News (MCN) | https://www.motorcyclenews.com/feed/ | 要確認 | 英国最大手・全メーカー網羅 |
| Total Motorcycle | https://www.totalmotorcycle.com/feed/ | 要確認 | 全メーカー・モデル情報豊富 |
| Motorcycles.News | https://www.motorcycles.news/en/feed/ | 要確認 | 欧州メーカー情報が強い |

※英語ソースは日本未発売情報を含む場合がある。
　rss_collectorがjp_relevanceフラグを判定する（下記参照）。

---

## 4. イベント情報（trust_score: 80）

| イベント | RSS URL | 疎通 | 備考 |
|---|---|---|---|
| 東京モーターサイクルショー | https://www.motorcycleshow.org/rss/ | ✅ | 年次・開催時期のみ有効 |

---

## 5. 対象外ソース（理由付き）

| ソース | 理由 |
|---|---|
| Honda RSS | 404（RDF廃止の可能性） |
| Yamaha RSS | 404（URL変更の可能性） |
| Ducati Japan | 404（RSS未提供） |
| BMW Motorrad Japan | TIMEOUT |
| Triumph Japan | 404（RSS未提供） |
| KTM Japan | 404（RSS未提供） |
| Aprilia Japan | 404（RSS未提供） |
| Harley-Davidson Japan | 404（RSS未提供） |
| WEBヤングマシン | 403（Botブロック） |
| PR TIMES バイク | 404（URL形式エラー） |
| 大阪モーターサイクルショー | ドメイン不達 |

---

## 6. 英語記事の処理ルール

### 翻訳
source_lang = 'en'の記事はnews_writerが日本語で記事生成する。
直訳ではなくRIDOトーンで自然な日本語に変換する。

### 日本向け関連性判定（jp_relevance）
rss_collectorが以下のキーワードを検出してフラグを立てる。

#### jp_relevance = 'low'（日本未発売の可能性あり）
```
US only / US market / North America only
UK only / Europe only / not available in Japan
US-spec / European spec
```

#### jp_relevance = 'high'（日本向け情報）
```
Japan / 日本 / 国内 / 国内導入 / 日本発売
Asia / アジア
```

#### jp_relevance = 'unknown'
上記いずれも検出されない場合。デフォルト値。

### news_writerでの注記ルール
jp_relevance = 'low'の記事には以下の注記を自動追加する。

```
※この情報は海外向けの発表です。
　日本での発売・仕様は未確定の場合があります。
```

jp_relevance = 'unknown'の場合は注記なし。
品質スコア（Layer2）のカテゴリ整合で-5点のペナルティを付与する。

---

## 収集設定

### 実行間隔
6時間ごと（0時・6時・12時・18時）

### 1ソースあたりの最大取得件数
20件

### 全体の最大格納件数（1実行あたり）
100件

### 記事の有効期限
7日以内のもののみ収集対象

---

## エラー時の対応

| エラー | 対応 |
|---|---|
| 404 | スキップ・部隊長にログ報告 |
| タイムアウト（30秒超） | 3回リトライ後にスキップ |
| 403 | スキップ・部隊長にアラート |
| 連続3回エラー | 部隊長経由でDiscordにアラート |

---

## 更新ルール

- 新規ソースの追加はリーダーの承認後
- 疎通確認は月次で実施（参謀が管理）
- 英語ソースの追加は日本語補完が目的に限る
