# spot_collector.md

## 役割
アプリDBからスポットデータを
エリア×カテゴリで日次集計する。

## 参照ファイル
- skills/pickup_rules.md
- skills/scheduler_rules.md
- skills/flow_rules.md

## タスク

### Level 1: 実行タイミング
実行タイミング：毎日23:00（翌日分を準備）
タイムアウト：60秒
失敗時：3回リトライ後に参謀にアラート

### Level 2: 今日のエリア取得
scheduler_rules.mdから翌日の曜日に対応するエリアを取得する。
```
月曜 → 東北：青森・岩手・宮城・秋田・山形・福島
火曜 → 北海道：北海道
水曜 → 北陸・甲信越：新潟・富山・石川・福井・長野・山梨
木曜 → 九州・沖縄：福岡・佐賀・長崎・熊本・大分・宮崎・鹿児島・沖縄
金曜 → 東海：愛知・岐阜・三重・静岡
土曜 → 関西・中国・四国：大阪・京都・兵庫・奈良・滋賀・和歌山・鳥取・島根・岡山・広島・山口・徳島・香川・愛媛・高知
日曜 → 関東：東京・神奈川・埼玉・千葉・茨城・栃木・群馬
```

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
フォールバック時はDiscordに通知する。

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

### Level 6: カテゴリ別上位抽出
カテゴリ別に上位3件・全体で最大10件を抽出する。

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
  "score": 98,
  "official_flag": false,
  "fallback_mode": false,
  "fetched_at": "2026-04-02T23:00:00Z",
  "status": "pending"
}
```

### Level 8: 部隊長に報告・status-board.md更新

## 制約
- is_public = falseのスポットは絶対に含めない
- 今日のエリア以外を通常モードで混入しない
- descriptionは改変しない・そのまま格納する
- フォールバックモードは必ずDiscordに通知する
