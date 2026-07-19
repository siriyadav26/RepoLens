"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RepoDetailView } from "@/components/repositories/repo-detail-view";
import Link from "next/link";

interface DbRepository {
  id: string;
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

export default function RepoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<DbRepository | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/repositories/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const repo = data.repository || data;
        setRepo(repo);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const Breadcrumb = ({ name }: { name?: string }) => (
    <nav className="page-breadcrumb">
      <Link href="/dashboard">Dashboard</Link>
      <span className="page-breadcrumb-sep">/</span>
      <Link href="/dashboard/repositories">Repositories</Link>
      {name && (
        <>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">{name}</span>
        </>
      )}
    </nav>
  );

  if (loading) {
    return (
      <div className="repo-page">
        <Breadcrumb />
        <div style={{ textAlign: "center", padding: "40px", color: "#0f8ca3" }}>
          Loading repository...
        </div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="repo-page">
        <Breadcrumb />
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          Repository not found.
        </div>
      </div>
    );
  }

  return (
    <div className="repo-page">
      <Breadcrumb name={repo.name} />
      <RepoDetailView repository={repo} />
    </div>
  );
}