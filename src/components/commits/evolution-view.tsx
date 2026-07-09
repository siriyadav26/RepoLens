"use client";

import { useState, useEffect } from "react";
import {
  GitCommit,
  Users,
  Plus,
  Minus,
  Calendar,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

interface EvolutionStats {
  totalCommits: number;
  activeContributors: number;
  contributors: { login: string; name: string; avatar: string | null; count: number }[];
  commitsPerMonth: { month: string; count: number }[];
  commitsPerWeek: { week: string; count: number }[];
  firstCommitDate: string | null;
  latestCommitDate: string | null;
  totalAdditions: number;
  totalDeletions: number;
}

interface EvolutionViewProps {
  repositoryId: string;
}

export function EvolutionView({ repositoryId }: EvolutionViewProps) {
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/repositories/${repositoryId}/evolution`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [repositoryId]);

  if (loading) {
    return (
      <div className="evolution-loading">
        <span className="dash-spinner" /> Loading evolution data...
      </div>
    );
  }

  if (!stats || stats.totalCommits === 0) {
    return (
      <div className="evolution-empty">
        <TrendingUp size={32} />
        <h3>No commit data yet</h3>
        <p>Import commits to see repository evolution.</p>
      </div>
    );
  }

  const maxMonthCount = Math.max(...stats.commitsPerMonth.map((c) => c.count), 1);

  return (
    <div className="evolution-section">
      <h3 className="commit-detail-section-title">Repository Evolution</h3>

      {/* Top Stats Row */}
      <div className="evolution-top-stats">
        <div className="evolution-stat">
          <GitCommit size={18} className="evolution-stat-icon" />
          <div className="evolution-stat-value">{stats.totalCommits}</div>
          <div className="evolution-stat-label">Total Commits</div>
        </div>
        <div className="evolution-stat">
          <Users size={18} className="evolution-stat-icon" />
          <div className="evolution-stat-value">{stats.activeContributors}</div>
          <div className="evolution-stat-label">Contributors</div>
        </div>
        <div className="evolution-stat">
          <Plus size={18} className="evolution-stat-icon evolution-icon-add" />
          <div className="evolution-stat-value">{stats.totalAdditions.toLocaleString()}</div>
          <div className="evolution-stat-label">Total Additions</div>
        </div>
        <div className="evolution-stat">
          <Minus size={18} className="evolution-stat-icon evolution-icon-del" />
          <div className="evolution-stat-value">{stats.totalDeletions.toLocaleString()}</div>
          <div className="evolution-stat-label">Total Deletions</div>
        </div>
      </div>

      {/* Date Range */}
      <div className="evolution-date-range">
        <Calendar size={14} />
        <span>
          {stats.firstCommitDate
            ? new Date(stats.firstCommitDate).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })
            : "N/A"}
        </span>
        <span className="evolution-range-arrow">→</span>
        <span>
          {stats.latestCommitDate
            ? new Date(stats.latestCommitDate).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })
            : "N/A"}
        </span>
      </div>

      {/* Commits Per Month Bar Chart */}
      {stats.commitsPerMonth.length > 0 && (
        <div className="evolution-chart-section">
          <h4 className="evolution-chart-title">Commits Per Month</h4>
          <div className="evolution-bar-chart">
            {stats.commitsPerMonth.map((item) => {
              const height = (item.count / maxMonthCount) * 100;
              return (
                <div key={item.month} className="evolution-bar-col">
                  <div className="evolution-bar-value">{item.count}</div>
                  <div
                    className="evolution-bar"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <div className="evolution-bar-label">
                    {item.month.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contributors */}
      {stats.contributors.length > 0 && (
        <div className="evolution-contributors">
          <h4 className="evolution-chart-title">Top Contributors</h4>
          <div className="evolution-contributor-list">
            {stats.contributors.slice(0, 10).map((c) => (
              <div key={c.login || c.name} className="evolution-contributor">
                {c.avatar ? (
                  <img src={c.avatar} alt={c.name} className="evolution-contributor-avatar" />
                ) : (
                  <div className="evolution-contributor-avatar evolution-avatar-placeholder">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="evolution-contributor-info">
                  <span className="evolution-contributor-name">{c.name}</span>
                  {c.login && (
                    <span className="evolution-contributor-login">@{c.login}</span>
                  )}
                </div>
                <div className="evolution-contributor-count">
                  <GitCommit size={12} />
                  {c.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}