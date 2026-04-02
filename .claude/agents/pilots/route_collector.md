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
briefing_context.priority_tags → 優先すべきタグ（今週のテーマに関連）
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

#### スポット品質フィルタ
全スポットの説明文・写真・カテゴリが全て空 → 除外
1件でも情報があれば通過。

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

priority_tagsに合致するルートはスコアに+5ボーナスを付与する。
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
  "tags": ["絶景", "温泉", "春"],
  "region": "愛知県, 岐阜県",
  "score": 147,
  "priority_tag_match": true,
  "is_official": false,
  "quoted_comments": ["ここの夕日は本当に最高でした"],
  "briefing_week": "2026-W14",
  "fetched_at": "2026-04-07T05:00:00Z",
  "status": "pending"
}
```

### Level 7: 部隊長に報告・status-board.md更新
```json
{
  "agent": "route_collector",
  "briefing_week": "2026-W14",
  "total_public_routes": 45,
  "distance_filtered": 3,
  "title_filtered": 1,
  "spot_filtered": 2,
  "passed": 39,
  "top10_selected": 10,
  "priority_tag_matched": 6,
  "timestamp": "2026-04-07T05:30:00Z"
}
```

## 制約
- コンテキストを読む前に収集しない
- 集計期間外のルートを含めない
- public以外のルートは絶対に含めない
- スコアリング式を独自に変更しない
- quoted_commentsは改変しない
