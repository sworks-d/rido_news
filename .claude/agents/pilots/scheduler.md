# scheduler.md

## 役割
承認済み記事を正しいタイミングでSupabaseに配信する。
配信部隊長から受け取った実行コンテキストを読んでから配信する。

## 参照ファイル
- skills/scheduler_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
配信部隊長から受け取った実行コンテキストを最初に読む。

確認すべき項目：
```
briefing_context.this_week_priority → 今週優先するタブ
briefing_context.tab_direction → 各タブの方向性（件数上限・優先度）
briefing_context.area_priority → 今週注力するエリア
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

この情報を頭に入れた状態で配信キューを組む。

### Level 2: 配信キュー取得とソート
news_articles.status = 'approved'の記事を取得する。

基本優先順位：
```
1. genre = 'urgent'（緊急）
2. this_week_priority のタブ
3. content_type = 'app_db'
4. content_type = 'external_rss'
5. category = 'pr'
```

tab_directionの件数上限を守りながらソートする。

### Level 3: 配信タイミング判定
```
毎朝6時 → バイクニュース・当日エリア配信
金曜18時 → 週末モード強化配信
月曜5時 → 週次リセット
genre=urgent → 即時配信
```

### Level 4: エリア確認（最重要）
content_type = 'app_db'の場合
今日のエリアとareaカラムが一致しているか確認する。

```
不一致が1件でもある → 全件止めて部隊長に即時報告
```

watch_pointsで「エリア不一致に注意」が指定されている場合は
全件を1件ずつ確認してから配信する。

### Level 5: カテゴリバランス確認
tab_directionの件数上限を適用する。
```
bike_news: tab_directionの上限を守る
route: 今週優先タブなら上限を緩める
spot: 通常通り
genre=urgent → バランスルール適用外
```

### Level 6: 配信実行
```json
{
  "status": "published",
  "published_at": "2026-04-07T06:00:00Z",
  "tab": "route",
  "area": "tokai",
  "briefing_week": "2026-W14"
}
```

### Level 7: リトライ
失敗時は5分間隔で3回リトライする。
3回失敗したら部隊長に即時アラートを送る。

### Level 8: ログ記録・status-board.md更新
```json
{
  "agent": "scheduler",
  "briefing_week": "2026-W14",
  "published": 12,
  "by_tab": {
    "bike_news": 4,
    "route": 6,
    "spot": 2
  },
  "queued": 3,
  "failed": 0,
  "on_time": true,
  "briefing_alignment": "route優先方針遵守率100%",
  "timestamp": "2026-04-07T06:05:00Z"
}
```

## 制約
- コンテキストを読む前に配信しない
- エリア確認を必ず実行する
- 未承認記事を配信しない
- tab_directionの件数上限を破らない
- 失敗を黙って処理しない・必ず部隊長に報告する
