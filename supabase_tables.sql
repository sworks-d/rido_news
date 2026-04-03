-- ============================================
-- RIDO ニュースブロック 追加テーブル
-- 既存テーブルへの変更は一切なし
-- ============================================

-- ============================================
-- 1. news_raw
-- 収集パイロットが素材を格納する
-- ============================================
CREATE TABLE news_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('external_rss', 'app_db')),
  content_type text NOT NULL CHECK (content_type IN ('bike_news', 'route', 'spot')),
  source_url text,
  source_name text,
  title text NOT NULL,
  body text,
  genre text,
  trust_score integer,
  duplicate_hash text UNIQUE,
  route_id uuid,
  spot_id uuid,
  score integer,
  official_flag boolean DEFAULT false,
  priority_tag_match boolean DEFAULT false,
  priority_category_match boolean DEFAULT false,
  fallback_mode boolean DEFAULT false,
  quoted_comments text[],
  tags text[],
  prefecture text,
  area text,
  season text,
  briefing_week text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_news_raw_status ON news_raw(status);
CREATE INDEX idx_news_raw_content_type ON news_raw(content_type);
CREATE INDEX idx_news_raw_briefing_week ON news_raw(briefing_week);

-- ============================================
-- 2. news_articles
-- 生成・品質判定済みの記事を格納する
-- ============================================
CREATE TABLE news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id uuid REFERENCES news_raw(id),
  source_type text NOT NULL CHECK (source_type IN ('external_rss', 'app_db')),
  content_type text NOT NULL CHECK (content_type IN ('bike_news', 'route', 'spot')),
  category text NOT NULL,
  tab text NOT NULL CHECK (tab IN ('bike_news', 'route', 'spot', 'pr', 'announcement')),
  title text NOT NULL,
  summary text NOT NULL,
  index_items text[] NOT NULL,
  sections jsonb NOT NULL,
  navigation jsonb,
  tags text[],
  genre text,
  tone_score integer CHECK (tone_score BETWEEN 1 AND 5),
  tone_notes text,
  selected_theme text,
  source_url text,
  source_name text,
  route_id uuid,
  spot_id uuid,
  area text,
  prefecture text,
  layer1_result text DEFAULT 'pending',
  layer2_score integer,
  layer3_result text,
  layer3_fixed text[],
  hook_result text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'pending_review', 'rejected', 'published')),
  briefing_week text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_news_articles_status ON news_articles(status);
CREATE INDEX idx_news_articles_tab ON news_articles(tab);
CREATE INDEX idx_news_articles_area ON news_articles(area);
CREATE INDEX idx_news_articles_briefing_week ON news_articles(briefing_week);
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at DESC);

-- ============================================
-- 3. news_quality_log
-- 品質判定の詳細ログ
-- ============================================
CREATE TABLE news_quality_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES news_articles(id),
  layer1_result text,
  layer1_reason text,
  layer2_score integer,
  layer2_breakdown jsonb,
  layer3_result text,
  layer3_fixed text[],
  hook_result text,
  hook_reason text,
  action text NOT NULL CHECK (action IN ('approved', 'auto_fixed', 'pending_review', 'rejected')),
  caution_check text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_news_quality_log_article_id ON news_quality_log(article_id);
CREATE INDEX idx_news_quality_log_action ON news_quality_log(action);

-- ============================================
-- 4. agent_runs
-- 全エージェントの実行ログ
-- ============================================
CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  task text NOT NULL,
  briefing_week text,
  status text NOT NULL CHECK (status IN ('running', 'success', 'error')),
  input_count integer DEFAULT 0,
  output_count integer DEFAULT 0,
  error_message text,
  metadata jsonb,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  duration_sec integer
);

CREATE INDEX idx_agent_runs_agent ON agent_runs(agent);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_started_at ON agent_runs(started_at DESC);

-- ============================================
-- 5. agent_status
-- 現在の各エージェントの状態（監視用）
-- ============================================
CREATE TABLE agent_status (
  agent text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('waiting', 'running', 'done', 'error')),
  last_run_at timestamptz,
  last_count integer,
  note text,
  alert_from text,
  alert_message text,
  updated_at timestamptz DEFAULT now()
);

-- 初期データ
INSERT INTO agent_status (agent, status) VALUES
  ('rss_collector', 'waiting'),
  ('route_collector', 'waiting'),
  ('spot_collector', 'waiting'),
  ('news_writer', 'waiting'),
  ('route_writer', 'waiting'),
  ('spot_writer', 'waiting'),
  ('quality_checker', 'waiting'),
  ('scheduler', 'waiting'),
  ('mechanic', 'waiting');

-- ============================================
-- 6. agent_decisions
-- エージェントの判断ログ（精度計測用）
-- ============================================
CREATE TABLE agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  decision_type text NOT NULL,
  action text NOT NULL,
  result text,
  reason text,
  adopted boolean DEFAULT false,
  briefing_week text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_decisions_agent ON agent_decisions(agent);
CREATE INDEX idx_agent_decisions_adopted ON agent_decisions(adopted);
CREATE INDEX idx_agent_decisions_briefing_week ON agent_decisions(briefing_week);

-- ============================================
-- 7. agent_precision_log
-- エージェント精度の週次サマリー
-- ============================================
CREATE TABLE agent_precision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  briefing_week text NOT NULL,
  total_decisions integer DEFAULT 0,
  adopted_count integer DEFAULT 0,
  precision_rate numeric(4,3),
  change_from_last_week numeric(4,3),
  top_mistake text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent, briefing_week)
);

CREATE INDEX idx_agent_precision_log_agent ON agent_precision_log(agent);
CREATE INDEX idx_agent_precision_log_week ON agent_precision_log(briefing_week);

-- ============================================
-- 8. weekly_briefings
-- 参謀が生成する週次ブリーフィング
-- ============================================
CREATE TABLE weekly_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_week text NOT NULL UNIQUE,
  rido_direction jsonb NOT NULL,
  last_week_summary jsonb,
  this_week_focus jsonb,
  tab_balance jsonb,
  org_health jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'distributed', 'archived')),
  generated_at timestamptz DEFAULT now(),
  distributed_at timestamptz
);

CREATE INDEX idx_weekly_briefings_week ON weekly_briefings(briefing_week);

-- ============================================
-- 9. skills_update_log
-- skillsファイルの更新履歴
-- ============================================
CREATE TABLE skills_update_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file text NOT NULL,
  problem text NOT NULL,
  diff text,
  changed_by text DEFAULT 'mechanic',
  requested_by text,
  approved_by text DEFAULT 'leader',
  briefing_week text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 10. skills_knowledge_log
-- 蓄積された知見のインデックス
-- ============================================
CREATE TABLE skills_knowledge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file text NOT NULL,
  pattern text NOT NULL,
  knowledge text NOT NULL,
  source_agent text,
  effect text,
  adopted_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_skills_knowledge_log_file ON skills_knowledge_log(file);

-- ============================================
-- 11. themes_log
-- テーマのパフォーマンス履歴
-- ============================================
CREATE TABLE themes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('route', 'spot')),
  briefing_week text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'sleeping')),
  level integer DEFAULT 1,
  ctr numeric(5,4),
  avg_duration_sec integer,
  published_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(theme_name, briefing_week)
);

CREATE INDEX idx_themes_log_theme ON themes_log(theme_name);
CREATE INDEX idx_themes_log_status ON themes_log(status);

-- ============================================
-- RLS設定
-- 既存テーブルへの書き込みを物理的に防ぐ
-- ============================================

-- 新規テーブルはAgentのサービスロールからのみアクセス
ALTER TABLE news_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_precision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_update_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_knowledge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes_log ENABLE ROW LEVEL SECURITY;

-- Flutterアプリ（anon/authenticated）はnews_articlesの公開記事のみ読める
CREATE POLICY "app_read_published_articles"
  ON news_articles FOR SELECT
  USING (status = 'published');

-- 既存テーブルへの書き込み防止ポリシー
-- （service_roleからのみ操作可能・anonとauthenticatedは読み取りのみ）
-- ※既存のRLSポリシーはそのまま維持する
