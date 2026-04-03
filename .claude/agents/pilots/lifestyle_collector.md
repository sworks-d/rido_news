# lifestyle_collector.md

## ステータス
**Ph1では無効。Ph2以降で有効化する。**
index.jsの該当箇所はコメントアウトのまま維持する。
有効化時はリーダーの承認後にコメントアウトを外す。

---

## 役割
グルメ・トラベル・キャンプ・温泉・道の駅・アウトドア・地域情報を収集する。
スポット・ルート記事の参考情報として蓄積する。
将来のWebメディア化時に独立記事として使える状態で格納する。

## 参照ファイル
- skills/lifestyle_sources.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
収集部隊長から受け取った実行コンテキストを読む。

確認すべき項目：
```
briefing_context.today_area → 今日のエリア
briefing_context.priority_genres → 優先ジャンル
pilot_context.watch_points → 今回の注意点
```

### Level 2: RSS取得
実行タイミング：毎朝3時（バイクニュース収集の前）
lifestyle_sources.mdの全ソースから収集する。
タイムアウト：30秒
失敗時：3回リトライ後にスキップ

### Level 3: フィルタリング

#### 日付フィルタ
```
published_at < NOW() - INTERVAL '30 days' → 除外
```

#### 重複判定
```
hash = MD5(title + source_url)
同一hashが存在する → 除外
```

#### 信頼スコア判定
```
trust_score >= 70 → 通過
trust_score < 70 → 除外
```

### Level 4: ジャンル・エリア判定

#### ジャンル判定
lifestyle_sources.mdのgenre定義に従い自動付与する。
ソースのgenreをそのまま使う。

#### エリア・都道府県判定
タイトル・本文から都道府県名を抽出する。

```
抽出キーワード例：
「長野」「信州」→ 長野県 / 北陸・甲信越
「愛知」「名古屋」→ 愛知県 / 東海
「北海道」「札幌」→ 北海道
```

都道府県が特定できない場合はprefecture = null・area = nullで格納する。

### Level 5: media_ready判定
以下の条件を満たす場合はmedia_ready = trueを付与する。

```
同じprefecture・genreの記事が
lifestyle_rawに10件以上蓄積されている
```

### Level 6: データ格納
```json
{
  "source_type": "lifestyle",
  "genre": "camp",
  "source_url": "https://...",
  "source_name": "CAMP HACK",
  "title": "記事タイトル",
  "body": "本文（最大2000字）",
  "tags": ["キャンプ", "長野県", "ソロキャンプ"],
  "area": "甲信越",
  "prefecture": "長野県",
  "duplicate_hash": "abc123",
  "trust_score": 85,
  "media_ready": false,
  "briefing_week": "2026-W14",
  "status": "pending",
  "fetched_at": "2026-04-07T03:00:00Z"
}
```

### Level 7: 部隊長に報告・status-board.md更新
```json
{
  "agent": "lifestyle_collector",
  "briefing_week": "2026-W14",
  "fetched": 90,
  "date_filtered": 12,
  "duplicate_filtered": 8,
  "trust_filtered": 3,
  "passed": 67,
  "by_genre": {
    "gourmet": 15,
    "travel": 12,
    "camp": 10,
    "onsen": 8,
    "roadside_station": 8,
    "outdoor": 8,
    "local": 6
  },
  "media_ready_flagged": 5,
  "timestamp": "2026-04-07T03:30:00Z"
}
```

## 制約
- lifestyle_sources.mdにないソースから収集しない
- バイクニュースには混入しない（lifestyle_rawに格納する）
- 1回の実行で最大70件まで格納する
- bodyは2000字で切り捨てる
- media_readyの判定基準を独自に変更しない
