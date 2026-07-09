"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GitCommit, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

interface CommitItem {
  id: string;
  sha: string;
  message: string | null;
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  author_date: string;
  committed_date: string;
  commit_url: string | null;
  additions: number;
  deletions: number;
  files_changed: number;
}

interface CommitListProps {
  repositoryId: string;
}

export function CommitList({ repositoryId }: CommitListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest">(
    (searchParams.get("sort") as "newest" | "oldest") || "newest"
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [authors, setAuthors] = useState<{ login: string; name: string }[]>([]);
  const [authorFilter, setAuthorFilter] = useState(searchParams.get("author") || "");
  const [showFilters, setShowFilters] = useState(false);

  const fetchCommits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        sort,
      });
      if (authorFilter) params.set("author", authorFilter);
      if (search) params.set("search", search);

      const res = await fetch(
        `/api/repositories/${repositoryId}/commits?${params}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch commits");
        setCommits([]);
        setTotal(0);
        return;
      }

      setCommits(data.commits || []);
      setTotal(data.total || 0);
      setAuthors(data.authors || []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [repositoryId, page, sort, authorFilter, search]);

  useEffect(() => {
    fetchCommits();
  }, [fetchCommits]);

  function applyFilters() {
    setPage(1);
    setSearch(searchInput);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setAuthorFilter("");
    setPage(1);
    setSort("newest");
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

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

  function truncateMessage(msg: string, max: number = 120) {
    const lines = msg.split("\n");
    const first = lines[0];
    if (first.length <= max) return first;
    return first.slice(0, max) + "...";
  }

  const hasActiveFilters = authorFilter || search;

  return (
    <div className="commit-section">
      {/* Search & Filter Bar */}
      <div className="commit-toolbar">
        <div className="commit-search">
          <MessageSquare size={16} className="commit-search-icon" />
          <input
            type="text"
            placeholder="Search by message, SHA, or author..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="commit-search-input"
          />
          <button onClick={applyFilters} className="commit-search-btn">
            Search
          </button>
        </div>

        <div className="commit-toolbar-right">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="commit-filter-toggle"
          >
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Filters {hasActiveFilters && <span className="commit-filter-badge" />}
          </button>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
            className="commit-sort-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="commit-filters-panel fade-in">
          <div className="commit-filter-row">
            <label className="commit-filter-label">Author</label>
            <select
              value={authorFilter}
              onChange={(e) => {
                setAuthorFilter(e.target.value);
                setPage(1);
              }}
              className="commit-filter-select"
            >
              <option value="">All Authors</option>
              {authors.map((a) => (
                <option key={a.login || a.name} value={a.login || a.name}>
                  {a.name} {a.login ? `(${a.login})` : ""}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="commit-clear-filters">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div className="commit-error fade-in">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="commit-loading">
          <span className="dash-spinner" /> Loading commits...
        </div>
      )}

      {/* Empty State */}
      {!loading && commits.length === 0 && !error && (
        <div className="commit-empty">
          <GitCommit size={32} />
          <h3>No commits found</h3>
          <p>
            {hasActiveFilters
              ? "Try adjusting your search or filters."
              : "Import commits to see the timeline."}
          </p>
        </div>
      )}

      {/* Commit List */}
      {!loading && commits.length > 0 && (
        <>
          <div className="commit-list-header">
            <span>{total} commit{total !== 1 ? "s" : ""}</span>
            {hasActiveFilters && <span className="commit-filtered-label"> (filtered)</span>}
          </div>
          <div className="commit-list">
            {commits.map((commit) => (
              <div
                key={commit.id}
                className="commit-item"
                onClick={() => router.push(`/dashboard/repositories/${repositoryId}/commits/${commit.id}`)}
              >
                <div className="commit-item-left">
                  {commit.author_avatar ? (
                    <img
                      src={commit.author_avatar}
                      alt={commit.author_name}
                      className="commit-avatar"
                    />
                  ) : (
                    <div className="commit-avatar commit-avatar-placeholder">
                      {commit.author_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="commit-item-info">
                    <div className="commit-message">
                      {truncateMessage(commit.message || "No message")}
                    </div>
                    <div className="commit-meta">
                      <span className="commit-author">{commit.author_name}</span>
                      <span className="commit-dot" />
                      <span className="commit-date">
                        {formatDate(commit.committed_date)}
                      </span>
                      <span className="commit-dot" />
                      <span className="commit-sha-short">
                        {commit.sha.slice(0, 7)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="commit-item-right">
                  <div className="commit-stats-mini">
                    <span className="commit-stat-add">+{commit.additions}</span>
                    <span className="commit-stat-del">-{commit.deletions}</span>
                  </div>
                  <span className="commit-files-count">
                    {commit.files_changed} file{commit.files_changed !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="commit-pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="commit-page-btn"
              >
                Previous
              </button>
              <span className="commit-page-info">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage(page + 1)}
                className="commit-page-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}