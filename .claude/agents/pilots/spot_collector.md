# spot_collector.md

## 役割
アプリDBからスポットデータをエリア×カテゴリで日次集計する。
収集部隊長から受け取った実行コンテキストを読んでから収集する。

## 参照ファイル
- skills/pickup_rules.md
- skills/scheduler_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
収集部隊長から受け取った実行コンテキストを最初に読む。

確認すべき項目：
```
briefing_context.this_week_message → 今週収集すべき方向性
briefing_context.today_area → 今日のエリア（必ず確認する）
briefing_context.priority_categories → 優先すべきカテゴリ
briefing_context.target_count → 今週の目標収集件数
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

### Level 2: エリア確認（最重要）
today_areaをコンテキストから取得する。
scheduler_rules.mdと照合して都道府県リストを確定する。

### Level 3: ユーザー密度確認
```sql
SELECT COUNT(*) as user_count
FROM profiles
WHERE area IN (今日の都道府県リスト)
```
```
user_count >= 1 → 通常モード
user_count = 0  → 全国フォールバックモード
```
フォールバック時は部隊長経由でDiscordに通知する。

### Level 4: フィルタリング
```
is_public = true（必須）
description・photo_url・tagsのいずれか1つ以上あること
```

### Level 5: スコアリング
```
= (like_count × 3)
+ (view_count × 1)
+ (description IS NOT NULL ? 5 : 0)
+ (photo_url IS NOT NULL ? 3 : 0)
+ (tags IS NOT NULL ? 2 : 0)
+ (official_flag = true ? 8 : 0)
```

priority_categoriesに合致するスポットはスコアに+5ボーナスを付与する。

### Level 6: カテゴリ別上位抽出
カテゴリ別に上位3件・全体で最大10件を抽出する。
priority_categoriesのカテゴリを先に枠を確保する。

### Level 7: データ格納
```json
{
  "source_type": "app_db",
  "content_type": "spot",
  "spot_id": "xxx",
  "name": "スポット名",
  "description": "ライダーが書いた説明文",
  "photo_url": "https://...",
  "category": "絶景",
  "area": "tokai",
  "prefecture": "愛知県",
  "score": 103,
  "priority_category_match": true,
  "official_flag": false,
  "fallback_mode": false,
  "briefing_week": "2026-W14",
  "fetched_at": "2026-04-07T23:00:00Z",
  "status": "pending"
}
```

### Level 8: 部隊長に報告・status-board.md更新
```json
{
  "agent": "spot_collector",
  "briefing_week": "2026-W14",
  "area": "tokai",
  "fallback_mode": false,
  "user_count_in_area": 234,
  "total_spots": 180,
  "quality_filtered": 45,
  "passed": 135,
  "top10_selected": 10,
  "priority_category_matched": 7,
  "timestamp": "2026-04-07T23:30:00Z"
}
```

## 制約
- コンテキストを読む前に収集しない
- is_public = falseのスポットは絶対に含めない
- 今日のエリア以外を通常モードで混入しない
- descriptionは改変しない
- フォールバックモードは必ず部隊長に報告する
