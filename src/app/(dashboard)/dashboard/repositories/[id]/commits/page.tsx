"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CommitList } from "@/components/commits/commit-list";
import { EvolutionView } from "@/components/commits/evolution-view";
import { ImportCommitsBtn } from "@/components/commits/import-commits-btn";

interface RepoInfo {
  id: string;
  full_name: string;
  name: string;
  owner_avatar: string | null;
  description: string | null;
  default_branch: string;
  commit_count?: number;
}

export default function CommitsPage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "evolution">("timeline");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/repositories/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setRepo(data?.repository || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="repo-page">
        <div className="commit-detail-loading">
          <span className="dash-spinner" /> Loading...
        </div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="repo-page">
        <div className="commit-detail-loading">
          <p>Repository not found.</p>
          <Link href="/dashboard/repositories" className="commit-back-link">
            <ArrowLeft size={16} /> Back to Repositories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-page">
      <div className="repo-page-back">
        <Link
          href={`/dashboard/repositories/${id}`}
          className="repo-page-back-link"
        >
          <ArrowLeft size={16} />
          {repo.name}
        </Link>
      </div>

      <div className="commit-page-header">
        <div>
          <h1 className="repo-page-title">Commit History</h1>
          <p className="repo-page-subtitle">
            {repo.full_name} — {repo.default_branch}
          </p>
        </div>
        <ImportCommitsBtn
          repositoryId={id}
          existingCount={repo.commit_count || 0}
        />
      </div>

      {/* Tabs */}
      <div className="commit-tabs">
        <button
          className={`commit-tab ${activeTab === "timeline" ? "active" : ""}`}
          onClick={() => setActiveTab("timeline")}
        >
          Timeline
        </button>
        <button
          className={`commit-tab ${activeTab === "evolution" ? "active" : ""}`}
          onClick={() => setActiveTab("evolution")}
        >
          Evolution
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "timeline" && (
        <Suspense
          fallback={
            <div className="commit-detail-loading">
              <span className="dash-spinner" /> Loading commits...
            </div>
          }
        >
          <CommitList repositoryId={id} />
        </Suspense>
      )}

      {activeTab === "evolution" && <EvolutionView repositoryId={id} />}
    </div>
  );
}