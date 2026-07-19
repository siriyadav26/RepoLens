"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { HealthDashboard } from "@/components/health/health-dashboard";

interface RepoInfo {
  id: string;
  full_name: string;
  name: string;
  owner_avatar: string | null;
  description: string | null;
  default_branch: string;
}

export default function HealthPage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/repositories/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setRepo(data?.repository || data || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="repo-page">
        <nav className="page-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="page-breadcrumb-sep">/</span>
          <Link href="/dashboard/repositories">Repositories</Link>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">Code Health</span>
        </nav>
        <div className="commit-detail-loading">
          <span className="dash-spinner" /> Loading...
        </div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="repo-page">
        <nav className="page-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="page-breadcrumb-sep">/</span>
          <Link href="/dashboard/repositories">Repositories</Link>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">Code Health</span>
        </nav>
        <div className="commit-detail-loading">
          <p>Repository not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-page">
      <nav className="page-breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href="/dashboard/repositories">Repositories</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href={`/dashboard/repositories/${id}`}>{repo.name}</Link>
        <span className="page-breadcrumb-sep">/</span>
        <span className="page-breadcrumb-current">Code Health</span>
      </nav>

      <div className="commit-page-header">
        <div>
          <h1 className="repo-page-title">Code Health</h1>
          <p className="repo-page-subtitle">
            {repo.full_name} — {repo.default_branch}
          </p>
        </div>
      </div>

      <HealthDashboard repositoryId={id} />
    </div>
  );
}