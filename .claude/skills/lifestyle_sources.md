# lifestyle_sources.md

## ステータス
**Ph1では無効。Ph2以降で有効化する。**
インフラ（テーブル・エージェント・スキル）は設計済み。
ソースが揃ったタイミングで有効化する。

---

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

## 有効ソース（疎通確認済み）

| ジャンル | ソース | RSS URL | trust_score |
|---|---|---|---|
| camp | CAMP HACK | https://camphack.nap-camp.com/feed/ | 85 |
| outdoor | BE-PAL | https://www.bepal.net/feed/ | 85 |
| local | まっぷるトラベルガイド | https://www.mapple.net/feed/ | 80 |

---

## 対象外ソース（疎通確認結果）

| ソース | URL | 結果 |
|---|---|---|
| 食べログニュース | https://award.tabelog.com/rss | 404 |
| Retty | https://retty.me/rss/ | 404 |
| るるぶ | https://rurubu.jp/rss/ | 404 |
| hinataキャンプ | https://hinata.me/feed/ | 404 |
| ナチュラム | https://blog.naturum.ne.jp/feed/ | 404 |
| じゃらん温泉 | https://www.jalan.net/onsen/rss/ | 404 |
| 道の駅公式 | https://www.michi-no-eki.jp/rss/ | 404 |
| OUTDOOR DAY | https://outdoorday.jp/feed/ | 404 |
| 観光庁 | https://www.mlit.go.jp/kankocho/rss/ | 404 |
| ぐるなびニュース | https://news.gnavi.co.jp/rss/ | ERROR |
| 旅行読売 | https://www.ryoko-yomiuri.co.jp/rss/ | ERROR |
| 温泉まるごと | https://onsen-marugoto.com/feed/ | ERROR |
| 道の駅ガイド | https://michinoeki-guide.com/feed/ | ERROR |
| PEAKS | https://www.peaks.media/feed/ | ERROR |
| じゃらんニュース | https://www.jalan.net/news/rss/ | TIMEOUT |

---

## 現状の課題と対応方針

有効ソースが3件（camp・outdoor・local）のみ。
gourmet・travel・onsen・roadside_stationのカバーが不足している。

### 追加確認候補
以下はRSS URLの別パスを試す価値がある。

```
じゃらんニュース → https://www.jalan.net/news/rss.xml
ぐるなび → https://r.gnavi.co.jp/rss/
道の駅 → https://www.michi-no-eki.jp/stations/rss
```

### 代替手段（Ph2以降で検討）
- Google News RSS（キーワード指定）
  例：https://news.google.com/rss/search?q=道の駅+ツーリング&hl=ja
- 地域観光協会の個別RSS

---

## 収集設定

### 実行間隔
1日1回（毎朝3時）

### 1ソースあたりの最大取得件数
10件

### 全体の最大格納件数（1実行あたり）
30件（有効ソース3件×10件）

### 記事の有効期限
30日以内

---

## エラー時の対応

| エラー | 対応 |
|---|---|
| 404 | スキップ・部隊長にログ報告 |
| タイムアウト | 3回リトライ後にスキップ |
| 連続3回エラー | 部隊長経由でDiscordにアラート |

---

## 更新ルール

- 新規ソースの追加はリーダーの承認後
- 疎通確認は月次で実施（参謀が管理）
- media_readyの閾値変更はリーダーの承認後
