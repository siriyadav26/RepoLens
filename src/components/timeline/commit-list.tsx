"use client";

import { useState } from "react";
import { GitCommit } from "lucide-react";
import { CommitDetailSheet, type CommitItem } from "./commit-detail-sheet";

interface CommitListProps {
  commits: CommitItem[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function truncateMessage(msg: string, max = 110) {
  const first = msg.split("\n")[0];
  return first.length <= max ? first : first.slice(0, max) + "…";
}

export function TimelineCommitList({ commits }: CommitListProps) {
  const [selected, setSelected] = useState<CommitItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openCommit(commit: CommitItem) {
    setSelected(commit);
    setSheetOpen(true);
  }

  if (commits.length === 0) {
    return (
      <div className="tl-empty-state">
        <GitCommit size={36} className="tl-empty-icon" />
        <h3 className="tl-empty-title">No commits yet</h3>
        <p className="tl-empty-sub">
          Import commits to see the activity timeline.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="tl-commit-list">
        <div className="tl-commit-list-header">
          <span>Latest {commits.length} commits</span>
        </div>
        <div className="tl-commits">
          {commits.map((commit) => (
            <button
              key={commit.sha}
              className="tl-commit-item"
              onClick={() => openCommit(commit)}
            >
              {/* Avatar */}
              <div className="tl-commit-avatar-wrap">
                {commit.author_avatar ? (
                  <img
                    src={commit.author_avatar}
                    alt={commit.author_name}
                    className="tl-commit-avatar"
                  />
                ) : (
                  <div className="tl-commit-avatar tl-avatar-placeholder">
                    {commit.author_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="tl-commit-info">
                <div className="tl-commit-message">
                  {truncateMessage(commit.message || "No message")}
                </div>
                <div className="tl-commit-meta">
                  <span className="tl-commit-author">{commit.author_name}</span>
                  <span className="tl-commit-dot" />
                  <span className="tl-commit-date">
                    {formatDate(commit.committed_date)}
                  </span>
                  <span className="tl-commit-dot" />
                  <code className="tl-commit-sha">
                    {commit.sha.slice(0, 7)}
                  </code>
                </div>
              </div>

              {/* Stats */}
              <div className="tl-commit-stats">
                <span className="tl-stat-add-mini">+{commit.additions}</span>
                <span className="tl-stat-del-mini">−{commit.deletions}</span>
                <span className="tl-commit-files">
                  {commit.files_changed}f
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <CommitDetailSheet
        commit={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
