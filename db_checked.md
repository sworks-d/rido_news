# DB確認タスク

以下のSQLを全て実行して、結果をこのファイルの下部に追記してください。

---

```sql
-- 1. テーブル一覧
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- 2. 全カラム定義
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. RLS設定
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 4. レコード件数
SELECT 'user_routes' as t, COUNT(*) FROM user_routes
UNION ALL SELECT 'spots', COUNT(*) FROM spots
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles;

-- 5. user_routesカラム確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'user_routes'
AND column_name IN ('id','publish_status','distance_km','title',
'like_count','save_count','view_count','is_official','created_at','tags','season');

-- 6. spotsカラム確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'spots'
AND column_name IN ('id','is_public','description','photo_url','tags',
'category','region','official_flag','like_count','view_count','user_route_id','created_at');

-- 7. profilesカラム確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('id','area','bike_model','created_at');
```

---

## 結果（ここに追記）

実行日時: 2026-04-03
実行方法: Supabase REST API（`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`）

### 1. テーブル一覧（public）

- ai_chat_request_logs
- checkins
- helmets
- news
- notifications
- privacy_areas
- profile_achievement_helmets
- profiles
- recommended_routes
- route_bookmarks
- route_comment_likes
- route_comments
- route_likes
- spot_bookmarks
- spot_comments
- spots
- user_helmets
- user_routes
- weather_cache

### 2. 全カラム定義（publicスキーマ公開テーブルのOpenAPI定義より）

| table_name  | column_name           | data_type                        | is_nullable |
| ----------- | --------------------- | -------------------------------- | ----------- |
| user_routes | id                    | uuid                             | NO          |
| user_routes | user_id               | uuid                             | NO          |
| user_routes | touring_log_id        | integer                          | YES         |
| user_routes | title                 | character varying                | NO          |
| user_routes | description           | text                             | YES         |
| user_routes | region                | character varying                | YES         |
| user_routes | prefecture            | character varying                | YES         |
| user_routes | category              | character varying                | YES         |
| user_routes | season                | character varying                | YES         |
| user_routes | tags                  | text[]                           | YES         |
| user_routes | distance_km           | double precision                 | NO          |
| user_routes | duration_min          | integer                          | NO          |
| user_routes | difficulty_level      | integer                          | YES         |
| user_routes | spot_count            | integer                          | YES         |
| user_routes | like_count            | integer                          | YES         |
| user_routes | comment_count         | integer                          | YES         |
| user_routes | view_count            | integer                          | YES         |
| user_routes | visit_count           | integer                          | YES         |
| user_routes | route_summary         | jsonb                            | YES         |
| user_routes | polyline_data         | text                             | YES         |
| user_routes | thumbnail_url         | text                             | YES         |
| user_routes | youtube_url           | text                             | YES         |
| user_routes | start_point           | extensions.geography(Point,4326) | YES         |
| user_routes | publish_status        | character varying                | YES         |
| user_routes | official_flag         | boolean                          | YES         |
| user_routes | published_at          | timestamp with time zone         | YES         |
| user_routes | created_at            | timestamp with time zone         | YES         |
| user_routes | updated_at            | timestamp with time zone         | YES         |
| user_routes | sub_category          | text                             | YES         |
| user_routes | converted_spot_id     | uuid                             | YES         |
| user_routes | weather_main          | character varying                | YES         |
| user_routes | weather_description   | text                             | YES         |
| user_routes | weather_icon          | character varying                | YES         |
| user_routes | temp_max              | numeric                          | YES         |
| user_routes | temp_min              | numeric                          | YES         |
| spots       | id                    | uuid                             | NO          |
| spots       | user_route_id         | uuid                             | YES         |
| spots       | user_id               | uuid                             | NO          |
| spots       | name                  | character varying                | NO          |
| spots       | description           | text                             | YES         |
| spots       | latitude              | double precision                 | YES         |
| spots       | longitude             | double precision                 | YES         |
| spots       | type                  | integer                          | YES         |
| spots       | sequence_number       | integer                          | NO          |
| spots       | visited_at            | timestamp with time zone         | YES         |
| spots       | photo_url             | text                             | YES         |
| spots       | category              | text                             | YES         |
| spots       | official_flag         | boolean                          | NO          |
| spots       | publish_status        | character varying                | YES         |
| spots       | submitted_at          | timestamp with time zone         | YES         |
| spots       | approved_at           | timestamp with time zone         | YES         |
| spots       | approved_by           | uuid                             | YES         |
| spots       | rejection_reason      | text                             | YES         |
| spots       | is_synced             | boolean                          | YES         |
| spots       | created_at            | timestamp with time zone         | YES         |
| spots       | updated_at            | timestamp with time zone         | YES         |
| spots       | prefecture            | text                             | YES         |
| spots       | related_spot_id       | uuid                             | YES         |
| spots       | sub_category          | text                             | YES         |
| spots       | good_time             | text                             | YES         |
| spots       | facilities            | jsonb                            | YES         |
| spots       | tag                   | text                             | YES         |
| spots       | address               | text                             | YES         |
| spots       | title                 | text                             | YES         |
| spots       | tags                  | text[]                           | YES         |
| spots       | comment_count         | integer                          | NO          |
| spots       | is_public             | boolean                          | NO          |
| spots       | created_by            | uuid                             | YES         |
| spots       | view_count            | integer                          | NO          |
| spots       | source_route_id       | uuid                             | YES         |
| spots       | photo_urls            | text[]                           | YES         |
| profiles    | id                    | uuid                             | NO          |
| profiles    | display_name          | text                             | YES         |
| profiles    | avatar_url            | text                             | YES         |
| profiles    | bio                   | text                             | YES         |
| profiles    | favorite_bike         | text                             | YES         |
| profiles    | created_at            | timestamp with time zone         | YES         |
| profiles    | updated_at            | timestamp with time zone         | YES         |
| profiles    | areas                 | text                             | YES         |
| profiles    | bike_maker            | text                             | YES         |
| profiles    | bike_name             | text                             | YES         |
| profiles    | rider_types           | text                             | YES         |
| profiles    | url                   | text                             | YES         |
| profiles    | is_category_visible   | boolean                          | YES         |
| profiles    | background_color      | text                             | YES         |
| profiles    | selected_helmet_id    | uuid                             | YES         |
| profiles    | equipped_helmet_id    | uuid                             | YES         |
| profiles    | website_url           | text                             | YES         |
| profiles    | sns_links             | jsonb                            | YES         |
| profiles    | interest_categories   | text                             | YES         |
| profiles    | notifications_enabled | boolean                          | NO          |
| profiles    | bike_type             | character varying                | YES         |
| profiles    | prefecture            | character varying                | YES         |
| profiles    | riding_years          | integer                          | YES         |

### 3. RLS設定

`SELECT tablename, rowsecurity FROM pg_tables ...` は `information_schema/pg_catalog` 参照が必要なため、anonキー経由のREST APIでは取得不可。

### 4. レコード件数

| t           | count |
| ----------- | ----: |
| user_routes |     3 |
| spots       |     9 |
| profiles    |     0 |

### 5. user_routesカラム確認（指定カラム）

エラー:

- `column user_routes.save_count does not exist`
- `column user_routes.is_official does not exist`（現行は `official_flag`）

### 6. spotsカラム確認（指定カラム）

エラー:

- `column spots.region does not exist`（現行は `prefecture`）

### 7. profilesカラム確認（指定カラム）

エラー:

- `column profiles.area does not exist`（現行は `areas`）
