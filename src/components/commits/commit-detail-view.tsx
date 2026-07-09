"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Calendar,
  User,
  FileCode,
  Plus,
  Minus,
} from "lucide-react";
import Link from "next/link";

interface CommitDetail {
  id: string;
  sha: string;
  message: string | null;
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  author_date: string;
  committed_date: string;
  commit_url: string | null;
  branch: string;
  parent_shas: string[];
  additions: number;
  deletions: number;
  files_changed: number;
}

export function CommitDetailView() {
  const { commitId } = useParams<{ commitId: string }>();
  const router = useRouter();
  const [commit, setCommit] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!commitId) return;
    fetch(`/api/commits/${commitId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setCommit(data?.commit || null);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load commit.");
        setLoading(false);
      });
  }, [commitId]);

  if (loading) {
    return (
      <div className="commit-detail-loading">
        <span className="dash-spinner" /> Loading commit details...
      </div>
    );
  }

  if (error || !commit) {
    return (
      <div className="commit-detail-loading">
        <p>{error || "Commit not found."}</p>
        <button
          onClick={() => router.back()}
          className="commit-back-btn"
        >
          Go Back
        </button>
      </div>
    );
  }

  const messageLines = (commit.message || "").split("\n");

  return (
    <div className="commit-detail">
      {/* Back */}
      <div className="commit-detail-back">
        <Link href="#" onClick={() => router.back()} className="commit-back-link">
          <ArrowLeft size={16} />
          Back to Commits
        </Link>
      </div>

      {/* Header */}
      <div className="commit-detail-header">
        <div className="commit-detail-header-left">
          {commit.author_avatar ? (
            <img
              src={commit.author_avatar}
              alt={commit.author_name}
              className="commit-detail-avatar"
            />
          ) : (
            <div className="commit-detail-avatar commit-avatar-placeholder">
              {commit.author_name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="commit-detail-title-area">
            <h1 className="commit-detail-title">
              {messageLines[0] || "No commit message"}
            </h1>
            <div className="commit-detail-subtitle">
              <span>
                {commit.author_name}
                {commit.author_login && (
                  <span className="commit-detail-login">
                    {" "}
                    (@{commit.author_login})
                  </span>
                )}
              </span>
              <span className="commit-dot" />
              <span>
                {new Date(commit.committed_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
        {commit.commit_url && (
          <a
            href={commit.commit_url}
            target="_blank"
            rel="noopener noreferrer"
            className="commit-detail-gh-btn"
          >
            <ExternalLink size={16} />
            View on GitHub
          </a>
        )}
      </div>

      {/* Stats Row */}
      <div className="commit-detail-stats">
        <div className="commit-detail-stat">
          <Plus size={14} className="commit-stat-add-icon" />
          <span className="commit-detail-stat-value">{commit.additions}</span>
          <span className="commit-detail-stat-label">additions</span>
        </div>
        <div className="commit-detail-stat">
          <Minus size={14} className="commit-stat-del-icon" />
          <span className="commit-detail-stat-value">{commit.deletions}</span>
          <span className="commit-detail-stat-label">deletions</span>
        </div>
        <div className="commit-detail-stat">
          <FileCode size={14} className="commit-detail-stat-icon" />
          <span className="commit-detail-stat-value">{commit.files_changed}</span>
          <span className="commit-detail-stat-label">files changed</span>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="commit-detail-grid">
        <div className="commit-detail-meta-item">
          <GitBranch size={16} className="commit-detail-meta-icon" />
          <div>
            <div className="commit-detail-meta-label">Branch</div>
            <div className="commit-detail-meta-value">{commit.branch}</div>
          </div>
        </div>
        <div className="commit-detail-meta-item">
          <Calendar size={16} className="commit-detail-meta-icon" />
          <div>
            <div className="commit-detail-meta-label">Authored</div>
            <div className="commit-detail-meta-value">
              {new Date(commit.author_date).toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          </div>
        </div>
        <div className="commit-detail-meta-item">
          <User size={16} className="commit-detail-meta-icon" />
          <div>
            <div className="commit-detail-meta-label">Author</div>
            <div className="commit-detail-meta-value">
              {commit.author_name}
              {commit.author_login && ` (${commit.author_login})`}
            </div>
          </div>
        </div>
        <div className="commit-detail-meta-item">
          <FileCode size={16} className="commit-detail-meta-icon" />
          <div>
            <div className="commit-detail-meta-label">SHA</div>
            <div className="commit-detail-meta-value commit-sha-full">
              {commit.sha}
            </div>
          </div>
        </div>
      </div>

      {/* Full Message */}
      {messageLines.length > 1 && (
        <div className="commit-detail-full-message">
          <h3 className="commit-detail-section-title">Full Commit Message</h3>
          <pre className="commit-message-pre">
            {commit.message}
          </pre>
        </div>
      )}

      {/* Parent Commits */}
      {commit.parent_shas.length > 0 && (
        <div className="commit-detail-parents">
          <h3 className="commit-detail-section-title">Parent Commits</h3>
          <div className="commit-parent-list">
            {commit.parent_shas.map((sha) => (
              <span key={sha} className="commit-parent-sha">
                {sha.slice(0, 12)}...
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}