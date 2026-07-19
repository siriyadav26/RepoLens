"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EvolutionDashboard } from "@/components/evolution/evolution-dashboard";

export default function EvolutionPage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<{ id: string; full_name: string; name: string; description: string | null; default_branch: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/repositories/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setRepo(d?.repository || d || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="repo-page"><nav className="page-breadcrumb"><Link href="/dashboard">Dashboard</Link><span className="page-breadcrumb-sep">/</span><Link href="/dashboard/repositories">Repositories</Link><span className="page-breadcrumb-sep">/</span><span className="page-breadcrumb-current">Architecture Evolution</span></nav><div className="commit-detail-loading"><span className="dash-spinner" /> Loading...</div></div>;
  if (!repo) return <div className="repo-page"><nav className="page-breadcrumb"><Link href="/dashboard">Dashboard</Link><span className="page-breadcrumb-sep">/</span><Link href="/dashboard/repositories">Repositories</Link><span className="page-breadcrumb-sep">/</span><span className="page-breadcrumb-current">Architecture Evolution</span></nav><div className="commit-detail-loading"><p>Repository not found.</p></div></div>;

  return (
    <div className="repo-page">
      <nav className="page-breadcrumb"><Link href="/dashboard">Dashboard</Link><span className="page-breadcrumb-sep">/</span><Link href="/dashboard/repositories">Repositories</Link><span className="page-breadcrumb-sep">/</span><Link href={`/dashboard/repositories/${id}`}>{repo.name}</Link><span className="page-breadcrumb-sep">/</span><span className="page-breadcrumb-current">Architecture Evolution</span></nav>
      <div className="commit-page-header"><div><h1 className="repo-page-title">Architecture Evolution</h1><p className="repo-page-subtitle">{repo.full_name} — {repo.default_branch}</p></div></div>
      <EvolutionDashboard repositoryId={id} />
    </div>
  );
}