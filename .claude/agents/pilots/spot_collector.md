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
briefing_context.today_area → 今日のエリア（必ず確認する）
briefing_context.priority_categories → 優先すべきカテゴリ
briefing_context.target_count → 今週の目標収集件数
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

### Level 2: エリア確認（最重要）
today_areaをコンテキストから取得する。
scheduler_rules.mdと照合して都道府県リストを確定する。

```
東海 → ['愛知県', '岐阜県', '三重県', '静岡県']
関東 → ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県']
関西・中国・四国 → ['大阪府', '京都府', '兵庫県', '奈良県', '滋賀県', '和歌山県',
                    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
                    '徳島県', '香川県', '愛媛県', '高知県']
東北 → ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県']
北海道 → ['北海道']
北陸・甲信越 → ['新潟県', '富山県', '石川県', '福井県', '長野県', '山梨県']
九州・沖縄 → ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
```

### Level 3: ユーザー密度確認
```sql
SELECT COUNT(*) as user_count
FROM profiles
WHERE areas ILIKE '%愛知%'
OR areas ILIKE '%岐阜%'
-- 今日の都道府県リストを全てOR条件で並べる
```

```
user_count >= 1 → 通常モード
user_count = 0  → 全国フォールバックモード
```
フォールバック時は部隊長経由でDiscordに通知する。

### Level 4: データ取得SQL
```sql
SELECT
  s.id,
  s.name,
  s.title,
  s.description,
  s.photo_url,
  s.photo_urls,
  s.category,
  s.sub_category,
  s.tags,
  s.prefecture,
  s.official_flag,
  s.view_count,
  s.created_at
FROM spots s
WHERE s.is_public = true
AND s.publish_status = 'public'
AND s.prefecture IN ({today_prefectures})
AND (
  s.description IS NOT NULL
  OR s.photo_url IS NOT NULL
  OR s.tags IS NOT NULL
)
```

フォールバックモード時はprefecture条件を外す。

### Level 5: スコアリング
```
= (view_count × 1)
+ (description IS NOT NULL ? 5 : 0)
+ (photo_url IS NOT NULL ? 3 : 0)
+ (tags IS NOT NULL ? 2 : 0)
+ (official_flag = true ? 8 : 0)
```

priority_categoriesに合致するスポットはスコアに+5ボーナス。

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
  "title": "タイトル（あれば）",
  "description": "ライダーが書いた説明文",
  "photo_url": "https://...",
  "photo_urls": ["https://..."],
  "category": "絶景",
  "tags": ["絶景", "温泉"],
  "area": "tokai",
  "prefecture": "愛知県",
  "score": 98,
  "official_flag": false,
  "priority_category_match": true,
  "fallback_mode": false,
  "briefing_week": "2026-W14",
  "fetched_at": "2026-04-07T23:00:00Z",
  "status": "pending"
}
```

### Level 8: 部隊長に報告・status-board.md更新

## 制約
- コンテキストを読む前に収集しない
- is_public = falseのスポットは絶対に含めない
- 今日のエリア以外を通常モードで混入しない
- descriptionは改変しない
- フォールバックモードは必ず部隊長に報告する
