-- ================================================================
-- RepoLens AI — Phase 2: Repositories Table Setup
-- ================================================================
-- WHY A NEW TABLE IS REQUIRED:
-- The existing Supabase database has no table suitable for storing
-- repository metadata. The auth system (Phase 1) uses Supabase's
-- built-in auth.users table, which is managed by Supabase and
-- cannot be extended with custom columns. We need a dedicated
-- `repositories` table to store GitHub repository data linked
-- to each authenticated user.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.repositories (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_id       BIGINT NOT NULL,
  full_name     TEXT NOT NULL,
  name          TEXT NOT NULL,
  owner_login   TEXT NOT NULL,
  owner_avatar  TEXT,
  description   TEXT,
  html_url      TEXT NOT NULL,
  stars         INTEGER DEFAULT 0,
  forks         INTEGER DEFAULT 0,
  watchers      INTEGER DEFAULT 0,
  open_issues   INTEGER DEFAULT 0,
  language      TEXT,
  topics        TEXT[] DEFAULT '{}',
  license       TEXT,
  default_branch TEXT DEFAULT 'main',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  github_created_at TIMESTAMPTZ,
  github_updated_at TIMESTAMPTZ,

  -- Ensure a user can't import the same repo twice
  UNIQUE(user_id, repo_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON public.repositories(user_id);

-- Index for sorting by import date
CREATE INDEX IF NOT EXISTS idx_repositories_created_at ON public.repositories(created_at DESC);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

-- Users can only see their own repositories
CREATE POLICY "Users can view own repositories"
  ON public.repositories FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own repositories
CREATE POLICY "Users can insert own repositories"
  ON public.repositories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own repositories
CREATE POLICY "Users can update own repositories"
  ON public.repositories FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own repositories
CREATE POLICY "Users can delete own repositories"
  ON public.repositories FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- Auto-update the updated_at timestamp on row change
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_repositories_updated ON public.repositories;
CREATE TRIGGER on_repositories_updated
  BEFORE UPDATE ON public.repositories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();