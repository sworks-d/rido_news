# rss_sources.md

## RSSソース定義

収集パイロット（rss_collector）が参照するソースリスト。
ここにないソースからは収集しない。

優先順位：メーカー公式 > バイク系メディア > プレスリリース

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

| メーカー | RSS URL | 疎通 |
|---|---|---|
| Kawasaki | https://www.kawasaki-motors.com/ja/news/rss/ | ✅ |
| Suzuki | https://www1.suzuki.co.jp/motor/rss/news.xml | ✅ |

※Honda・Yamaha・海外メーカー（Ducati/BMW/Triumph/KTM/Aprilia/Harley）は
　RSS未提供または404のため対象外。
　公式サイトのURL変更が確認できた場合は整備士が追加する。

---

## 2. バイク系メディア（trust_score: 85）

| メディア | RSS URL | 疎通 | 特徴 |
|---|---|---|---|
| Webikeプラス | https://news.webike.net/feed/ | ✅ | 国内最大級・新車・用品 |
| モーサイ | https://mc-web.jp/feed/ | ✅ | 老舗・信頼性高い |
| バイクブロスマガジンズ | https://news.bikebros.co.jp/feed/ | ✅ | 新型情報・試乗レポート |

※WEBヤングマシン（young-machine.com）は403（Botブロック）のため対象外。
　User-Agent設定で解消できた場合は整備士が追加する。

---

## 3. イベント情報（trust_score: 80）

| イベント | RSS URL | 疎通 | 備考 |
|---|---|---|---|
| 東京モーターサイクルショー | https://www.motorcycleshow.org/rss/ | ✅ | 年次・開催時期のみ有効 |

※大阪モーターサイクルショーはドメイン不達のため対象外。

---

## 4. 対象外ソース（理由付き）

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
| 404（RSS URL不達） | スキップ・部隊長にログ報告 |
| タイムアウト（30秒超） | 3回リトライ後にスキップ |
| 403（Botブロック） | スキップ・部隊長にアラート |
| RSS形式エラー | スキップ・部隊長にアラート |
| 連続3回エラー | 部隊長経由でDiscordにアラート |

---

## 更新ルール

- RSSのURLが変わった場合は整備士が更新する
- 新規ソースの追加はリーダーの承認後に追加する
- 疎通確認は月次で実施する（参謀が管理）
- 対象外ソースの復活確認は四半期ごとに実施する
