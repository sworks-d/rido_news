# route_collector.md

## 役割
アプリDBからルートデータを週次で集計する。

## 参照ファイル
- skills/pickup_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 集計タイミング
実行タイミング：毎週月曜05:00
集計期間：前週月曜00:00〜日曜23:59
タイムアウト：60秒
失敗時：3回リトライ後に参謀にアラート

### Level 2: 対象データ取得
```sql
SELECT
  ur.*,
  COUNT(s.id) as spot_count,
  SUM(CASE WHEN s.description IS NOT NULL THEN 1 ELSE 0 END) as spots_with_desc,
  SUM(CASE WHEN s.photo_url IS NOT NULL THEN 1 ELSE 0 END) as spots_with_photo,
  SUM(CASE WHEN s.tags IS NOT NULL THEN 1 ELSE 0 END) as spots_with_tags
FROM user_routes ur
LEFT JOIN spots s ON s.user_route_id = ur.id
WHERE ur.publish_status = 'public'
AND ur.created_at >= '集計開始日'
AND ur.created_at < '集計終了日'
GROUP BY ur.id
```

### Level 3: フィルタリング

#### 基本条件
```
publish_status = 'public'
distance_km >= 10
spot_count >= 1
```

#### タイトルNGワード
```
テスト・test・TEST・無題・untitled
undefined・null・NULL・tmp・temp・仮
```
大文字小文字を区別しない。

#### スポット品質フィルタ
```
spots_with_desc = 0
AND spots_with_photo = 0
AND spots_with_tags = 0
→ 除外（1件でも情報があれば通過）
```

### Level 4: スコアリング
```
ルートスコア
= (like_count × 3)
+ (save_count × 2)
+ (view_count × 1)
+ (is_official ? 10 : 0)

スポットスコア（全スポットの合計）
= (spots_with_desc × 5)
+ (spots_with_photo × 3)
+ (spots_with_tags × 2)

最終スコア = ルートスコア + スポットスコア
```
同点の場合はcreated_atが新しい方を優先する。

### Level 5: 上位抽出
最終スコア上位10件を抽出する。
10件未満の場合はrecommended_routesで補完する。

### Level 6: データ格納
```json
{
  "source_type": "app_db",
  "content_type": "route",
  "route_id": "xxx",
  "title": "ルートタイトル",
  "distance_km": 230,
  "spot_count": 5,
  "tags": ["絶景", "温泉"],
  "region": "愛知県, 岐阜県",
  "score": 142,
  "is_official": false,
  "quoted_comments": ["ここの夕日は本当に最高でした"],
  "fetched_at": "2026-04-07T05:00:00Z",
  "status": "pending"
}
```

### Level 7: 部隊長に報告・status-board.md更新

## 制約
- 集計期間外のルートを含めない
- public以外のルートは絶対に含めない
- スコアリング式を独自に変更しない
- quoted_commentsは改変しない・そのまま格納する
- 上位10件を超えて格納しない
