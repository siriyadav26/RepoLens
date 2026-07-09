-- ================================================================
-- Phase 12: Cross-Repository Intelligence Platform
-- SQL Migration — Run this in your Supabase SQL Editor
-- ================================================================

-- 1. Cross-Repository Comparison Reports
CREATE TABLE IF NOT EXISTS cross_repo_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_ids UUID[] NOT NULL,
  comparison_type VARCHAR(30) NOT NULL CHECK (comparison_type IN ('full', 'architecture', 'tech_stack', 'similarity', 'contributors', 'custom')),
  ai_summary JSONB DEFAULT '{}'::jsonb,
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  report_markdown TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Repository Similarity Scores
CREATE TABLE IF NOT EXISTS repo_similarity_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id_a UUID NOT NULL,
  repository_id_b UUID NOT NULL,
  overall_score NUMERIC(5, 4) DEFAULT 0,
  shared_concepts JSONB DEFAULT '[]'::jsonb,
  unique_a JSONB DEFAULT '[]'::jsonb,
  unique_b JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repository_id_a, repository_id_b)
);

-- 3. Cross-Repo Analysis Sessions (track selected repos per analysis)
CREATE TABLE IF NOT EXISTS cross_repo_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_repository_ids UUID[] NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  analysis_results JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cross_repo_reports_user ON cross_repo_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_repo_reports_type ON cross_repo_reports(user_id, comparison_type);
CREATE INDEX IF NOT EXISTS idx_cross_repo_reports_created ON cross_repo_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_similarity_user ON repo_similarity_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_similarity_pair ON repo_similarity_scores(user_id, repository_id_a, repository_id_b);

CREATE INDEX IF NOT EXISTS idx_cross_repo_sessions_user ON cross_repo_sessions(user_id);

-- ================================================================
-- RLS
-- ================================================================
ALTER TABLE cross_repo_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_similarity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_repo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cross-repo reports" ON cross_repo_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cross-repo reports" ON cross_repo_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cross-repo reports" ON cross_repo_reports FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own similarity scores" ON repo_similarity_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own similarity scores" ON repo_similarity_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own similarity scores" ON repo_similarity_scores FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cross-repo sessions" ON cross_repo_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cross-repo sessions" ON cross_repo_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_cross_repo_reports_updated_at
  BEFORE UPDATE ON cross_repo_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();