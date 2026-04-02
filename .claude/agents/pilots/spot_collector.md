# spot_collector.md

## 役割
アプリDBからスポットデータを
エリア×カテゴリで日次集計する。

## 参照ファイル
- skills/pickup_rules.md
- skills/scheduler_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 指示の受け取り・ブリーフィング確認
収集部隊長から指示を受け取る。
以下を必ず確認してから集計を開始する。

```
確認項目：
□ 今日のエリア（task.today_area）← 最初に確認
□ 優先カテゴリ（task.priority_category）
□ 目標件数（task.target_count）
□ 自分の注意点（pilot_context.watch_points）
□ 今週の文脈（task.today_context）
```

注意点がある場合は収集前に自分に言い聞かせる：
「フォールバックモードへの切り替えは慎重に判断する。
ユーザー数が0でも近隣エリアで補完できないか先に確認する。」

### Level 2: 実行タイミング
実行タイミング：毎日23:00（翌日分を準備）
タイムアウト：60秒
失敗時：3回リトライ後に部隊長にアラート

### Level 3: 今日のエリア確認
scheduler_rules.mdから翌日の曜日に対応するエリアを取得する。
指示のtoday_areaと一致しているか確認する。
不一致の場合は部隊長に報告して指示を待つ。

### Level 4: ユーザー密度確認
```sql
SELECT COUNT(*) as user_count
FROM profiles
WHERE area IN (今日の都道府県リスト)
```

```
user_count >= 1 → 通常モード
user_count = 0  → 近隣エリアで補完を試みる
近隣でも0 → 全国フォールバックモード
```

フォールバック時は部隊長にDiscord通知を依頼する。

### Level 5: フィルタリング
```
is_public = true（必須）
description・photo_url・tagsのいずれか1つ以上あること
今日のエリア（prefecture）に含まれること（通常モード時必須）
```

### Level 6: スコアリング
```
= (like_count × 3)
+ (view_count × 1)
+ (description IS NOT NULL ? 5 : 0)
+ (photo_url IS NOT NULL ? 3 : 0)
+ (tags IS NOT NULL ? 2 : 0)
+ (official_flag = true ? 8 : 0)
```

priority_categoryに指定されたカテゴリのスポットはスコアを1.5倍にする。

### Level 7: カテゴリ別上位抽出
カテゴリ別に上位3件・全体で最大10件を抽出する。
priority_categoryのカテゴリを先に枠を確保する。

### Level 8: データ格納
格納前に全件のprefectureが今日のエリアに含まれるか最終確認する。
1件でも不一致があれば除外してから格納する。

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
  "score": 98,
  "official_flag": false,
  "fallback_mode": false,
  "fetched_at": "2026-04-02T23:00:00Z",
  "status": "pending"
}
```

### Level 9: 部隊長に報告・status-board.md更新

## 制約
- is_public = falseのスポットは絶対に含めない
- 今日のエリア以外のスポットを通常モードで混入しない
- descriptionは改変しない
- フォールバックモードは必ず部隊長に通知する
