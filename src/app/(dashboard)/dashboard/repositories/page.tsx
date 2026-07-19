"use client";

import { useEffect, useState } from "react";
import { RepoList } from "@/components/repositories/repo-list";
import { RepoImportForm } from "@/components/repositories/repo-import-form";

interface DbRepository {
  id: string;
  repo_id: number;
  full_name: string;
  name: string;
  owner_login: string;
  owner_avatar: string | null;
  description: string | null;
  html_url: string;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  license: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  github_created_at: string | null;
  github_updated_at: string | null;
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<DbRepository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/repositories")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const repos = data.repositories || data;
        setRepositories(Array.isArray(repos) ? repos : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="repo-page">
      <div className="repo-page-header">
        <div>
          <h1 className="repo-page-title">Repositories</h1>
          <p className="repo-page-subtitle">
            Import public GitHub repositories to analyze and track.
          </p>
        </div>
        <RepoImportForm />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#0f8ca3" }}>
          Loading repositories...
        </div>
      ) : (
        <RepoList repositories={repositories} />
      )}
    </div>
  );
}