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
