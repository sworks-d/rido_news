# lifestyle_sources.md

## ライフスタイルソース定義

バイクで行く先々で体験することを収集するソースリスト。
今はスポット・ルート記事生成時の参考情報として使う。
将来のWebメディア化時に独立記事として配信できる。

---

## ジャンル定義

| genre | 内容 | RIDOとの紐付け |
|---|---|---|
| gourmet | グルメ・飲食店情報 | スポット（グルメ）と紐付け |
| travel | 旅行・宿泊情報 | ルート・スポットと紐付け |
| camp | キャンプ・アウトドア泊 | スポット（キャンプ場）と紐付け |
| onsen | 温泉・銭湯情報 | スポット（温泉）と紐付け |
| roadside_station | 道の駅情報 | スポット（道の駅）と紐付け |
| outdoor | アウトドア・林道・自然 | ルート（林道・オフロード）と紐付け |
| local | 地域情報・観光協会 | エリア別スポット補完 |
| other | 上記以外のライフスタイル情報 | 汎用 |

---

## 信頼スコアの定義

| スコア | 基準 |
|---|---|
| 85〜100 | 公式・大手メディア |
| 70〜84 | 専門メディア・地域公式 |
| 70未満 | 収集対象外 |

---

## 1. グルメ（genre: gourmet）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| 食べログニュース | https://award.tabelog.com/rss | 85 | 受賞・注目店情報 |
| ぐるなびニュース | https://news.gnavi.co.jp/rss/ | 80 | 飲食トレンド |
| Rettyニュース | https://retty.me/rss/ | 75 | ユーザー口コミ系 |

---

## 2. トラベル（genre: travel）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| じゃらんニュース | https://www.jalan.net/news/rss/ | 85 | 旅行・宿泊情報 |
| 旅行読売 | https://www.ryoko-yomiuri.co.jp/rss/ | 80 | 老舗旅行誌 |
| るるぶ旅行情報 | https://rurubu.jp/rss/ | 80 | 観光情報 |

---

## 3. キャンプ（genre: camp）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| CAMP HACK | https://camphack.nap-camp.com/feed/ | 85 | キャンプ専門メディア |
| hinataキャンプ | https://hinata.me/feed/ | 80 | キャンプ・アウトドア |
| ナチュラムアウトドア情報 | https://blog.naturum.ne.jp/feed/ | 75 | アウトドア用品・情報 |

---

## 4. 温泉（genre: onsen）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| 温泉まるごと | https://onsen-marugoto.com/feed/ | 80 | 温泉専門情報 |
| じゃらん温泉特集 | https://www.jalan.net/onsen/rss/ | 85 | 宿泊込み温泉情報 |

---

## 5. 道の駅（genre: roadside_station）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| 道の駅公式（国交省） | https://www.michi-no-eki.jp/rss/ | 90 | 公式・全国網羅 |
| 道の駅ガイド | https://michinoeki-guide.com/feed/ | 75 | 口コミ・レポート |

---

## 6. アウトドア（genre: outdoor）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| BE-PAL | https://www.bepal.net/feed/ | 85 | 老舗アウトドア誌 |
| PEAKS | https://www.peaks.media/feed/ | 80 | 登山・アウトドア |
| OUTDOOR DAY | https://outdoorday.jp/feed/ | 75 | アウトドア全般 |

---

## 7. 地域情報（genre: local）

| ソース | RSS URL | trust_score | 備考 |
|---|---|---|---|
| 観光庁ニュース | https://www.mlit.go.jp/kankocho/rss/ | 90 | 公式観光情報 |
| まっぷるトラベルガイド | https://www.mapple.net/feed/ | 80 | 地域観光情報 |

---

## 収集設定

### 実行間隔
1日1回（毎朝3時・バイクニュース収集の前）

### 1ソースあたりの最大取得件数
10件

### 全体の最大格納件数（1実行あたり）
70件

### 記事の有効期限
30日以内（バイクニュースより長め・コンテンツとして蓄積するため）

---

## spot_writer・route_writerでの使い方

生成時に同じエリアのlifestyle_rawを検索して参考情報として使う。

```
今日のエリア = "tokai"（東海）
        ↓
lifestyle_rawからprefectureが愛知・岐阜・三重・静岡の
直近30日のデータを取得
        ↓
スポット記事の「行くときのポイント」や
ルート記事の「立ち寄りスポット」に自然に組み込む
```

使用した記事はstatus = 'referenced'に更新する。

---

## 将来のメディア化判断基準

以下に該当する記事はmedia_ready = trueを付与する。

```
同じエリア・ジャンルの記事が10件以上蓄積された
referenced回数が3回以上
CTR（将来計測）が高い
```

media_ready = trueの記事が30件以上蓄積されたジャンルは
メディア化の候補として参謀がリーダーに提案する。

---

## エラー時の対応

| エラー | 対応 |
|---|---|
| 404 | スキップ・部隊長にログ報告 |
| タイムアウト | 3回リトライ後にスキップ |
| 403 | スキップ・部隊長にアラート |
| 連続3回エラー | 部隊長経由でDiscordにアラート |

---

## 更新ルール

- 新規ソースの追加はリーダーの承認後
- 疎通確認は月次で実施（参謀が管理）
- media_readyの閾値変更はリーダーの承認後
