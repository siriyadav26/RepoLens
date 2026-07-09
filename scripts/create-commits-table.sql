-- ================================================================
-- RepoLens AI — Phase 3: Commits Table Setup
-- ================================================================
-- WHY A NEW TABLE IS REQUIRED:
-- Phase 2 created the `repositories` table to store repo metadata.
-- Phase 3 needs to store individual commits for each repository.
-- Each commit has a unique SHA, author info, date, and file stats.
-- This table references `repositories` with CASCADE delete so
-- commits are automatically removed when a repository is deleted.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.commits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id   UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  sha             TEXT NOT NULL,
  message         TEXT,
  author_name     TEXT NOT NULL,
  author_login    TEXT,
  author_avatar   TEXT,
  author_date     TIMESTAMPTZ NOT NULL,
  committed_date  TIMESTAMPTZ NOT NULL,
  commit_url      TEXT,
  branch          TEXT DEFAULT 'main',
  parent_shas     TEXT[] DEFAULT '{}',
  additions       INTEGER DEFAULT 0,
  deletions       INTEGER DEFAULT 0,
  files_changed   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure a repo can't have the same commit twice
  UNIQUE(repository_id, sha)
);

-- Index for fast lookups by repository
CREATE INDEX IF NOT EXISTS idx_commits_repository_id ON public.commits(repository_id);

-- Index for user-level queries
CREATE INDEX IF NOT EXISTS idx_commits_user_id ON public.commits(user_id);

-- Index for sorting by commit date
CREATE INDEX IF NOT EXISTS idx_commits_committed_date ON public.commits(committed_date DESC);

-- Index for author filtering
CREATE INDEX IF NOT EXISTS idx_commits_author_login ON public.commits(author_login);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commits"
  ON public.commits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commits"
  ON public.commits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commits"
  ON public.commits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own commits"
  ON public.commits FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- Auto-update the updated_at timestamp on row change
-- (Reuses the existing handle_updated_at function from Phase 2)
-- ================================================================
DROP TRIGGER IF EXISTS on_commits_updated ON public.commits;
CREATE TRIGGER on_commits_updated
  BEFORE UPDATE ON public.commits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();