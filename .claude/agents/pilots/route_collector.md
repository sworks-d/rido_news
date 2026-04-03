# route_collector.md

## 役割
アプリDBからルートデータを週次で集計する。
収集部隊長から受け取った実行コンテキストを読んでから収集する。

## 参照ファイル
- skills/pickup_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
収集部隊長から受け取った実行コンテキストを最初に読む。

確認すべき項目：
```
briefing_context.this_week_message → 今週収集すべき方向性
briefing_context.priority_tags → 優先すべきタグ
briefing_context.target_count → 今週の目標収集件数
briefing_context.collection_period → 集計期間
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

### Level 2: 集計タイミング
実行タイミング：毎週月曜05:00
集計期間：briefing_contextのcollection_periodを使用
タイムアウト：60秒
失敗時：3回リトライ後に部隊長にアラート

### Level 3: データ取得SQL
```sql
SELECT
  ur.id,
  ur.title,
  ur.distance_km,
  ur.spot_count,
  ur.like_count,
  ur.view_count,
  ur.official_flag,
  ur.tags,
  ur.season,
  ur.category,
  ur.prefecture,
  ur.created_at,
  COUNT(s.id) as spot_count_actual,
  SUM(CASE WHEN s.description IS NOT NULL THEN 1 ELSE 0 END) as spots_with_desc,
  SUM(CASE WHEN s.photo_url IS NOT NULL THEN 1 ELSE 0 END) as spots_with_photo,
  SUM(CASE WHEN s.tags IS NOT NULL THEN 1 ELSE 0 END) as spots_with_tags,
  ARRAY_AGG(s.description) FILTER (WHERE s.description IS NOT NULL) as quoted_comments
FROM user_routes ur
LEFT JOIN spots s ON s.user_route_id = ur.id
WHERE ur.publish_status = 'public'
AND ur.distance_km >= 10
AND ur.created_at >= '{collection_start}'
AND ur.created_at < '{collection_end}'
GROUP BY ur.id
HAVING COUNT(s.id) >= 1
```

### Level 4: フィルタリング

#### タイトルNGワード
```
テスト・test・TEST・無題・untitled・undefined・null・NULL・tmp・temp・仮
```

#### スポット品質フィルタ
```
spots_with_desc = 0
AND spots_with_photo = 0
AND spots_with_tags = 0
→ 除外（1件でも情報があれば通過）
```

### Level 5: スコアリング
```
ルートスコア
= (like_count × 3)
+ (view_count × 1)
+ (official_flag = true ? 10 : 0)

スポットスコア
= (spots_with_desc × 5)
+ (spots_with_photo × 3)
+ (spots_with_tags × 2)

最終スコア = ルートスコア + スポットスコア
```

priority_tagsに合致するルートはスコアに+5ボーナスを付与する。
同点の場合はcreated_atが新しい方を優先する。

### Level 6: 上位抽出
最終スコア上位10件を抽出する。
10件未満の場合はrecommended_routesで補完する。

### Level 7: データ格納
```json
{
  "source_type": "app_db",
  "content_type": "route",
  "route_id": "xxx",
  "title": "ルートタイトル",
  "distance_km": 230,
  "spot_count": 5,
  "tags": ["絶景", "温泉"],
  "prefecture": "愛知県",
  "season": "春",
  "score": 142,
  "official_flag": false,
  "priority_tag_match": true,
  "quoted_comments": ["ここの夕日は本当に最高でした"],
  "briefing_week": "2026-W14",
  "fetched_at": "2026-04-07T05:00:00Z",
  "status": "pending"
}
```

### Level 8: 部隊長に報告・status-board.md更新

## 制約
- コンテキストを読む前に収集しない
- publish_status = 'public'以外は絶対に含めない
- スコアリング式を独自に変更しない
- quoted_commentsは改変しない
- 上位10件を超えて格納しない
