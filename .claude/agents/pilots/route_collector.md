# route_collector.md

## 役割
アプリDBからルートデータを週次で集計する。

## 参照ファイル
- skills/pickup_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 指示の受け取り・ブリーフィング確認
収集部隊長から指示を受け取る。
以下を必ず確認してから集計を開始する。

```
確認項目：
□ 優先テーマ（task.priority_theme）
□ スコアリング強調点（task.scoring_emphasis）
□ 目標件数（task.target_count）
□ 自分の注意点（pilot_context.watch_points）
□ 今週の文脈（task.today_context）
```

### Level 2: 集計タイミング
実行タイミング：毎週月曜05:00
集計期間：前週月曜00:00〜日曜23:59
タイムアウト：60秒
失敗時：3回リトライ後に部隊長にアラート

### Level 3: 対象データ取得
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

### Level 4: フィルタリング

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

#### スポット品質フィルタ
```
spots_with_desc = 0
AND spots_with_photo = 0
AND spots_with_tags = 0
→ 除外
```

### Level 5: スコアリング
scoring_emphasisの指示を反映してスコアリングを実施する。

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

scoring_emphasisで「spots_with_desc重視」等の指示がある場合は
該当の係数を1.5倍にする。

### Level 6: 優先テーマとの照合
priority_themesで指定されたテーマに合致するルートを
スコアと同等の優先度で上位に含める。

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
  "region": "愛知県, 岐阜県",
  "score": 142,
  "is_official": false,
  "priority_theme_match": "春の桜ロードルート",
  "quoted_comments": ["ここの夕日は本当に最高でした"],
  "fetched_at": "2026-04-07T05:00:00Z",
  "status": "pending"
}
```

### Level 8: 部隊長に報告・status-board.md更新

## 制約
- 集計期間外のルートを含めない
- public以外のルートは絶対に含めない
- quoted_commentsは改変しない
- 上位10件を超えて格納しない
