-- ================================================================
-- RepoLens AI — Phase 13: AI Code Analysis Table Setup
-- ================================================================

CREATE TABLE IF NOT EXISTS public.code_analyses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  analysis      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by user and repository
CREATE INDEX IF NOT EXISTS idx_code_analyses_repo ON public.code_analyses(user_id, repository_id);

-- Enable RLS
ALTER TABLE public.code_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own code analyses"
  ON public.code_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own code analyses"
  ON public.code_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own code analyses"
  ON public.code_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own code analyses"
  ON public.code_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at Trigger
CREATE TRIGGER on_code_analyses_updated
  BEFORE UPDATE ON public.code_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
