"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  ExternalLink,
  Star,
  GitFork,
  Eye,
  CircleDot,
  Clock,
  TrendingUp,
  Brain,
} from "lucide-react";
import { formatCount } from "@/lib/github";

interface RepoListItem {
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
  created_at: string;
  updated_at: string;
}

interface RepoListProps {
  repositories: RepoListItem[];
}

export function RepoList({ repositories }: RepoListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, repoId: string) {
    e.stopPropagation();
    if (!confirm("Remove this repository from your list?")) return;

    setDeleting(repoId);
    try {
      const res = await fetch(`/api/repositories/${repoId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // silently fail, user can retry
    } finally {
      setDeleting(null);
    }
  }

  if (repositories.length === 0) {
    return (
      <div className="repo-empty-state">
        <div className="repo-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </div>
        <h3 className="repo-empty-title">No repositories yet</h3>
        <p className="repo-empty-desc">
          Import your first public GitHub repository to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="repo-list">
      {repositories.map((repo) => (
        <div
          key={repo.id}
          className="repo-list-item"
          onClick={() => router.push(`/dashboard/repositories/${repo.id}`)}
        >
          <div className="repo-list-left">
            {repo.owner_avatar && (
              <img
                src={repo.owner_avatar}
                alt={repo.owner_login}
                className="repo-list-avatar"
                width={36}
                height={36}
              />
            )}
            <div className="repo-list-info">
              <div className="repo-list-name">{repo.full_name}</div>
              {repo.description && (
                <div className="repo-list-desc">
                  {repo.description.length > 80
                    ? repo.description.slice(0, 80) + "..."
                    : repo.description}
                </div>
              )}
              <div className="repo-list-meta">
                {repo.language && (
                  <span className="repo-list-lang">
                    <span className="repo-list-lang-dot" />
                    {repo.language}
                  </span>
                )}
                {repo.stars > 0 && (
                  <span className="repo-list-stat">
                    <Star size={13} /> {formatCount(repo.stars)}
                  </span>
                )}
                {repo.forks > 0 && (
                  <span className="repo-list-stat">
                    <GitFork size={13} /> {formatCount(repo.forks)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="repo-list-right">
            <div className="repo-list-dates">
              <span className="repo-list-date">
                <Clock size={12} /> Imported{" "}
                {new Date(repo.created_at).toLocaleDateString()}
              </span>
              <span className="repo-list-date">
                <Eye size={12} /> Viewed{" "}
                {new Date(repo.updated_at).toLocaleDateString()}
              </span>
            </div>
            <div className="repo-list-actions">
              {/* Commit Timeline quick-link */}
              <Link
                href={`/dashboard/repositories/${repo.id}/timeline`}
                className="repo-list-action-btn repo-list-timeline-btn"
                title="Commit Timeline"
                onClick={(e) => e.stopPropagation()}
              >
                <TrendingUp size={15} />
              </Link>
              {/* AI Code Analysis quick-link */}
              <Link
                href={`/dashboard/repositories/${repo.id}/analysis`}
                className="repo-list-action-btn repo-list-analysis-btn"
                title="AI Code Analysis"
                onClick={(e) => e.stopPropagation()}
              >
                <Brain size={15} />
              </Link>
              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="repo-list-action-btn"
                title="Open on GitHub"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={15} />
              </a>
              <button
                className="repo-list-action-btn repo-list-delete-btn"
                title="Remove"
                disabled={deleting === repo.id}
                onClick={(e) => handleDelete(e, repo.id)}
              >
                {deleting === repo.id ? (
                  <span className="dash-spinner" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}