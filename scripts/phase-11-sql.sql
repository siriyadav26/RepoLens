-- ================================================================
-- Phase 11: AI Engineering Dashboard & Observability
-- SQL Migration — Run this in your Supabase SQL Editor
-- ================================================================

-- 1. AI Request Metrics — logs every LLM/RAG/Embedding request
CREATE TABLE IF NOT EXISTS ai_request_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id UUID,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('llm', 'rag', 'embedding', 'health_analysis', 'doc_generation', 'evolution_analysis', 'commit_explain')),
  provider VARCHAR(50),
  model VARCHAR(100),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'rate_limited', 'timeout')),
  latency_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  tokens_estimated BOOLEAN DEFAULT FALSE,
  error_type VARCHAR(50),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Provider Statistics — aggregated per-provider metrics (updated on each request)
CREATE TABLE IF NOT EXISTS provider_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  rate_limited_requests INTEGER DEFAULT 0,
  total_prompt_tokens BIGINT DEFAULT 0,
  total_completion_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  tokens_estimated BOOLEAN DEFAULT FALSE,
  avg_latency_ms NUMERIC(10, 2) DEFAULT 0,
  min_latency_ms INTEGER DEFAULT 0,
  max_latency_ms INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider, model)
);

-- 3. Error Logs — detailed error tracking
CREATE TABLE IF NOT EXISTS ai_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id UUID,
  error_type VARCHAR(50) NOT NULL CHECK (error_type IN ('provider_error', 'api_failure', 'rate_limit', 'retrieval_error', 'embedding_error', 'network_failure', 'timeout', 'unknown')),
  provider VARCHAR(50),
  request_type VARCHAR(20),
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Dashboard Snapshots — periodic aggregated snapshots for trend visualization
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_ai_requests INTEGER DEFAULT 0,
  total_rag_requests INTEGER DEFAULT 0,
  total_embeddings INTEGER DEFAULT 0,
  total_llm_requests INTEGER DEFAULT 0,
  total_health_analyses INTEGER DEFAULT 0,
  total_doc_generations INTEGER DEFAULT 0,
  total_evolution_analyses INTEGER DEFAULT 0,
  total_commit_explains INTEGER DEFAULT 0,
  active_repositories INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  ai_success_rate NUMERIC(5, 4) DEFAULT 0,
  avg_response_time_ms NUMERIC(10, 2) DEFAULT 0,
  avg_retrieval_time_ms NUMERIC(10, 2) DEFAULT 0,
  total_prompt_tokens BIGINT DEFAULT 0,
  total_completion_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  provider_breakdown JSONB DEFAULT '{}'::jsonb,
  error_breakdown JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- 5. Conversation Analytics — tracks conversation sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL,
  message_count INTEGER DEFAULT 0,
  total_ai_responses INTEGER DEFAULT 0,
  avg_response_length INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_request_metrics_user_id ON ai_request_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_metrics_created_at ON ai_request_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_request_metrics_type ON ai_request_metrics(user_id, request_type);
CREATE INDEX IF NOT EXISTS idx_ai_request_metrics_status ON ai_request_metrics(user_id, status);

CREATE INDEX IF NOT EXISTS idx_provider_stats_user ON provider_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_stats_provider ON provider_statistics(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_error_logs_user ON ai_error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON ai_error_logs(user_id, error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON ai_error_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON dashboard_snapshots(user_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_repo ON conversation_sessions(user_id, repository_id);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================

ALTER TABLE ai_request_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own request metrics" ON ai_request_metrics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own request metrics" ON ai_request_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own request metrics" ON ai_request_metrics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own provider stats" ON provider_statistics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own provider stats" ON provider_statistics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own provider stats" ON provider_statistics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own error logs" ON ai_error_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own error logs" ON ai_error_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own error logs" ON ai_error_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own snapshots" ON dashboard_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON dashboard_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshots" ON dashboard_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own conversations" ON conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- ================================================================
-- Updated_at trigger function (reuse existing if available)
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_provider_stats_updated_at
  BEFORE UPDATE ON provider_statistics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- Aggregation helper function for snapshots
-- ================================================================
CREATE OR REPLACE FUNCTION generate_daily_snapshot(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
  v_total_ai INT;
  v_total_rag INT;
  v_total_embed INT;
  v_total_llm INT;
  v_total_health INT;
  v_total_doc INT;
  v_total_evo INT;
  v_total_explain INT;
  v_success_rate NUMERIC;
  v_avg_resp NUMERIC;
  v_avg_retrieval NUMERIC;
  v_prompt_toks BIGINT;
  v_completion_toks BIGINT;
  v_total_toks BIGINT;
  v_errors INT;
  v_active_repos INT;
  v_total_conv INT;
  v_provider_breakdown JSONB;
  v_error_breakdown JSONB;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE request_type = 'rag'),
    COUNT(*) FILTER (WHERE request_type = 'embedding'),
    COUNT(*) FILTER (WHERE request_type = 'llm' OR request_type IN ('health_analysis','doc_generation','evolution_analysis','commit_explain')),
    COUNT(*) FILTER (WHERE request_type = 'health_analysis'),
    COUNT(*) FILTER (WHERE request_type = 'doc_generation'),
    COUNT(*) FILTER (WHERE request_type = 'evolution_analysis'),
    COUNT(*) FILTER (WHERE request_type = 'commit_explain')
  INTO v_total_ai, v_total_rag, v_total_embed, v_total_llm, v_total_health, v_total_doc, v_total_evo, v_total_explain
  FROM ai_request_metrics
  WHERE user_id = p_user_id
    AND created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day';

  SELECT
    CASE WHEN COUNT(*) > 0 THEN
      (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*))
    ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN
      AVG(latency_ms)
    ELSE 0 END,
    CASE WHEN COUNT(*) FILTER (WHERE request_type = 'rag') > 0 THEN
      AVG(latency_ms) FILTER (WHERE request_type = 'rag')
    ELSE 0 END,
    COALESCE(SUM(prompt_tokens), 0),
    COALESCE(SUM(completion_tokens), 0),
    COALESCE(SUM(total_tokens), 0),
    COUNT(*) FILTER (WHERE status = 'error' OR status = 'rate_limited' OR status = 'timeout')
  INTO v_success_rate, v_avg_resp, v_avg_retrieval, v_prompt_toks, v_completion_toks, v_total_toks, v_errors
  FROM ai_request_metrics
  WHERE user_id = p_user_id
    AND created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day';

  -- Active repos (repos with any AI activity today)
  SELECT COUNT(DISTINCT repository_id) INTO v_active_repos
  FROM ai_request_metrics
  WHERE user_id = p_user_id
    AND repository_id IS NOT NULL
    AND created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day';

  -- Conversation sessions today
  SELECT COUNT(*) INTO v_total_conv
  FROM conversation_sessions
  WHERE user_id = p_user_id
    AND started_at >= p_date
    AND started_at < p_date + INTERVAL '1 day';

  -- Provider breakdown
  SELECT COALESCE(jsonb_object_agg(provider, cnt), '{}'::jsonb) INTO v_provider_breakdown
  FROM (
    SELECT provider, COUNT(*) as cnt
    FROM ai_request_metrics
    WHERE user_id = p_user_id
      AND created_at >= p_date
      AND created_at < p_date + INTERVAL '1 day'
    GROUP BY provider
  ) sub;

  -- Error breakdown
  SELECT COALESCE(jsonb_object_agg(error_type, cnt), '{}'::jsonb) INTO v_error_breakdown
  FROM (
    SELECT error_type, COUNT(*) as cnt
    FROM ai_request_metrics
    WHERE user_id = p_user_id
      AND status IN ('error', 'rate_limited', 'timeout')
      AND created_at >= p_date
      AND created_at < p_date + INTERVAL '1 day'
    GROUP BY error_type
  ) sub;

  INSERT INTO dashboard_snapshots (
    user_id, snapshot_date,
    total_ai_requests, total_rag_requests, total_embeddings,
    total_llm_requests, total_health_analyses, total_doc_generations,
    total_evolution_analyses, total_commit_explains,
    active_repositories, total_conversations,
    ai_success_rate, avg_response_time_ms, avg_retrieval_time_ms,
    total_prompt_tokens, total_completion_tokens, total_tokens,
    total_errors, provider_breakdown, error_breakdown
  ) VALUES (
    p_user_id, p_date,
    v_total_ai, v_total_rag, v_total_embed,
    v_total_llm, v_total_health, v_total_doc,
    v_total_evo, v_total_explain,
    v_active_repos, v_total_conv,
    v_success_rate, v_avg_resp, v_avg_retrieval,
    v_prompt_toks, v_completion_toks, v_total_toks,
    v_errors, v_provider_breakdown, v_error_breakdown
  )
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    total_ai_requests = EXCLUDED.total_ai_requests,
    total_rag_requests = EXCLUDED.total_rag_requests,
    total_embeddings = EXCLUDED.total_embeddings,
    total_llm_requests = EXCLUDED.total_llm_requests,
    total_health_analyses = EXCLUDED.total_health_analyses,
    total_doc_generations = EXCLUDED.total_doc_generations,
    total_evolution_analyses = EXCLUDED.total_evolution_analyses,
    total_commit_explains = EXCLUDED.total_commit_explains,
    active_repositories = EXCLUDED.active_repositories,
    total_conversations = EXCLUDED.total_conversations,
    ai_success_rate = EXCLUDED.ai_success_rate,
    avg_response_time_ms = EXCLUDED.avg_response_time_ms,
    avg_retrieval_time_ms = EXCLUDED.avg_retrieval_time_ms,
    total_prompt_tokens = EXCLUDED.total_prompt_tokens,
    total_completion_tokens = EXCLUDED.total_completion_tokens,
    total_tokens = EXCLUDED.total_tokens,
    total_errors = EXCLUDED.total_errors,
    provider_breakdown = EXCLUDED.provider_breakdown,
    error_breakdown = EXCLUDED.error_breakdown;
END;
$$ LANGUAGE plpgsql;