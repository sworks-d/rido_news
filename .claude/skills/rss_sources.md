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

### 国内メーカー
| メーカー | RSS URL | 備考 |
|---|---|---|
| Honda | https://www.honda.co.jp/rss/motorproducts.rdf | 二輪製品情報 |
| Yamaha | https://www.yamaha-motor.co.jp/mc/news/rss.xml | バイクニュース |
| Kawasaki | https://www.kawasaki-motors.com/ja/news/rss/ | 新着情報 |
| Suzuki | https://www1.suzuki.co.jp/motor/rss/news.xml | ニュース |

### 海外メーカー（日本語サイト）
| メーカー | RSS URL | 備考 |
|---|---|---|
| Ducati Japan | https://www.ducati.com/jp/ja/news/rss | ニュース |
| BMW Motorrad Japan | https://www.bmw-motorrad.jp/ja/public/news.rss | ニュース |
| Triumph Japan | https://www.triumphmotorcycles.jp/rss | ニュース |
| KTM Japan | https://www.ktm.com/ja-jp/news/rss.xml | ニュース |
| Aprilia Japan | https://www.aprilia.com/jp_JA/news/rss/ | ニュース |
| Harley-Davidson Japan | https://www.harley-davidson.com/jp/ja/news/rss.xml | ニュース |

※メーカー公式RSSは提供状況が変わる場合がある。
　404エラーが続く場合はrss_collectorが部隊長に報告する。

---

## 2. バイク系メディア（trust_score: 85）

| メディア | RSS URL | 特徴 |
|---|---|---|
| Webikeプラス | https://news.webike.net/feed/ | 国内最大級・新車・用品・ツーリング |
| WEBヤングマシン | https://young-machine.com/feed/ | 新車情報・速報性が高い |
| モーサイ | https://mc-web.jp/feed/ | 老舗・信頼性高い |
| バイクブロスマガジンズ | https://news.bikebros.co.jp/feed/ | 新型情報・試乗レポート |

---

## 3. プレスリリース（trust_score: 75）

| サービス | RSS URL | 備考 |
|---|---|---|
| PR TIMES（バイクタグ） | https://prtimes.jp/rss/keyword/バイク.rss | バイク関連PR |
| PR TIMES（二輪タグ） | https://prtimes.jp/rss/keyword/二輪.rss | 二輪関連PR |

---

## 4. イベント情報（trust_score: 80）

| イベント | RSS URL | 備考 |
|---|---|---|
| 東京モーターサイクルショー | https://www.motorcycleshow.org/rss/ | 年次イベント |
| 大阪モーターサイクルショー | https://www.osaka-motorcycleshow.jp/rss/ | 年次イベント |

※イベント系RSSは開催時期のみアクティブ。
　オフシーズンは404になることがある。

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
| RSS形式エラー | スキップ・部隊長にアラート |
| 連続3回エラー | 部隊長経由でDiscordにアラート |

---

## 更新ルール

- RSSのURLが変わった場合は整備士が更新する
- 新規ソースの追加はリーダーの承認後に追加する
- 信頼スコアの変更は参謀の分析レポートを根拠にする
