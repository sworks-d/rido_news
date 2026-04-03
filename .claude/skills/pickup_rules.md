# pickup_rules.md

## ルート・スポットのピックアップ基準

---

## 1. ルートのピックアップ基準

### 集計期間
月曜00:00〜日曜23:59（週次リセット）
更新タイミング：毎週月曜05:00

### フィルタリング条件
```
publish_status = 'public'           必須
distance_km >= 10                   10km未満除外
spot_count >= 1                     スポットなし除外
```

### タイトルNGワード
```
テスト・test・TEST・無題・untitled
undefined・null・NULL・tmp・temp・仮
```
大文字小文字を区別しない。

### スポット品質フィルタ
紐づく全スポットの説明文・写真・カテゴリが
全て空の場合は除外する。
1件でも情報があれば通過。

### スコアリング
```
ルートスコア
= (like_count × 3)
+ (view_count × 1)
+ (official_flag = true ? 10 : 0)

スポットスコア（全スポットの合計）
= (description IS NOT NULL ? 5 : 0)
+ (photo_url IS NOT NULL ? 3 : 0)
+ (tags IS NOT NULL ? 2 : 0)

最終スコア = ルートスコア + スポットスコア
```

※save_countはDBに存在しないため除外。
同点の場合はcreated_atが新しい方を優先する。

### 表示件数
最大10件（スコア上位）
0件の場合はrecommended_routesで補完する。

---

## 2. スポットのピックアップ基準

### 集計期間
毎日23:00に翌日分を集計する。

### フィルタリング条件
```
is_public = true                    必須
publish_status = 'public'           必須
description・photo_url・tagsの
いずれか1つ以上あること
```

### スコアリング
```
= (view_count × 1)
+ (description IS NOT NULL ? 5 : 0)
+ (photo_url IS NOT NULL ? 3 : 0)
+ (tags IS NOT NULL ? 2 : 0)
+ (official_flag = true ? 8 : 0)
```

※spotsにlike_countは存在しないため除外。

### エリア判定
scheduler_rules.mdの曜日×エリア定義を参照する。
profilesテーブルのareasカラム（text型）を使用する。

```sql
SELECT COUNT(*) FROM profiles
WHERE areas ILIKE '%愛知%'
OR areas ILIKE '%岐阜%'
OR areas ILIKE '%三重%'
OR areas ILIKE '%静岡%'
```

ユーザー数が0の場合は全国フォールバックモードに切り替える。

### エリアフィルタ（spots）
spotsのprefectureカラムで絞り込む。
```sql
WHERE spots.prefecture IN ('愛知県', '岐阜県', '三重県', '静岡県')
```

### カテゴリ別上位抽出
カテゴリ別に上位3件・全体で最大10件を抽出する。

---

## 3. タブ表示切り替え基準

### フェーズ判定（参謀が週次で計測）

| フェーズ | 条件 | タブ順 |
|---|---|---|
| 立ち上げ期 | 公開ルート100件未満 | スポット→ニュース→ルート |
| 成長期 | 公開ルート100件以上 | ルート→スポット→ニュース |

切り替えは毎週月曜の集計時に自動判定・自動切り替え。
