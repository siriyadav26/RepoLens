"use client";

import { useState } from "react";

import { formatCount } from "@/lib/github";
import {
  Star,
  GitFork,
  Eye,
  CircleDot,
  ExternalLink,
  Calendar,
  GitBranch,
  Scale,
  Tag,
  GitCommit,
  FileText,
  Activity,
  Network,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface RepoDetail {
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

interface RepoDetailViewProps {
  repository: RepoDetail;
}

export function RepoDetailView({ repository: r }: RepoDetailViewProps) {
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<string | null>(null);

  async function handleGenerateEmbeddings() {
    setIndexing(true);
    setIndexResult(null);
    try {
      const res = await fetch(`/api/repositories/${r.id}/index`, {
        method: "POST",
      });
      const data = await res.json();
      console.log("[Generate Embeddings] Result:", data);
      if (data.success) {
        setIndexResult(
          `✅ Done — ${data.filesIndexed} files, ${data.embeddingsStored} embeddings in ${data.durationMs}ms`
        );
      } else {
        setIndexResult(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setIndexResult("❌ Request failed");
    } finally {
      setIndexing(false);
    }
  }
  return (
    <div className="repo-detail">
      {/* Header */}
      <div className="repo-detail-header">
        <div className="repo-detail-header-left">
          {r.owner_avatar && (
            <img
              src={r.owner_avatar}
              alt={r.owner_login}
              className="repo-detail-avatar"
              width={48}
              height={48}
            />
          )}
          <div>
            <h1 className="repo-detail-name">{r.full_name}</h1>
            {r.description && (
              <p className="repo-detail-desc">{r.description}</p>
            )}
          </div>
        </div>
        <a
          href={r.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="repo-detail-gh-btn"
        >
          <ExternalLink size={15} />
          <span>View on GitHub</span>
        </a>
      </div>

      {/* Stats Row */}
      <div className="repo-detail-stats">
        <div className="repo-detail-stat">
          <Star size={18} />
          <span className="repo-detail-stat-value">{formatCount(r.stars)}</span>
          <span className="repo-detail-stat-label">Stars</span>
        </div>
        <div className="repo-detail-stat">
          <GitFork size={18} />
          <span className="repo-detail-stat-value">{formatCount(r.forks)}</span>
          <span className="repo-detail-stat-label">Forks</span>
        </div>
        <div className="repo-detail-stat">
          <Eye size={18} />
          <span className="repo-detail-stat-value">{formatCount(r.watchers)}</span>
          <span className="repo-detail-stat-label">Watchers</span>
        </div>
        <div className="repo-detail-stat">
          <CircleDot size={18} />
          <span className="repo-detail-stat-value">{formatCount(r.open_issues)}</span>
          <span className="repo-detail-stat-label">Open Issues</span>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="repo-detail-grid">
        <MetaItem
          icon={<GitBranch size={16} />}
          label="Default Branch"
          value={r.default_branch}
        />
        <MetaItem
          icon={<Tag size={16} />}
          label="Language"
          value={r.language ?? "Not specified"}
        />
        <MetaItem
          icon={<Scale size={16} />}
          label="License"
          value={r.license ?? "Not specified"}
        />
        <MetaItem
          icon={<Calendar size={16} />}
          label="Created on GitHub"
          value={
            r.github_created_at
              ? new Date(r.github_created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "N/A"
          }
        />
        <MetaItem
          icon={<Calendar size={16} />}
          label="Last Updated on GitHub"
          value={
            r.github_updated_at
              ? new Date(r.github_updated_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "N/A"
          }
        />
      </div>

      {/* Action Links */}
      <div className="repo-detail-commits-link" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href={`/dashboard/repositories/${r.id}/commits`} className="repo-detail-commits-btn">
          <GitCommit size={16} />
          <span>View Commit History</span>
        </Link>
        <Link href={`/dashboard/repositories/${r.id}/timeline`} className="repo-detail-commits-btn">
          <TrendingUp size={16} />
          <span>Commit Timeline</span>
        </Link>
        <Link href={`/dashboard/repositories/${r.id}/analysis`} className="repo-detail-commits-btn">
          <Sparkles size={16} />
          <span>AI Code Analysis</span>
        </Link>
        <Link href={`/dashboard/repositories/${r.id}/documentation`} className="repo-detail-commits-btn">
          <FileText size={16} />
          <span>AI Documentation</span>
        </Link>
        <Link href={`/dashboard/repositories/${r.id}/health`} className="repo-detail-commits-btn">
          <Activity size={16} />
          <span>Code Health</span>
        </Link>
        <Link href={`/dashboard/repositories/${r.id}/evolution-arch`} className="repo-detail-commits-btn">
          <Network size={16} />
          <span>Architecture</span>
        </Link>
      </div>

      {/* Generate Embeddings */}
      <div style={{ marginTop: "24px" }}>
        <button
          onClick={handleGenerateEmbeddings}
          disabled={indexing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: indexing ? "#aaa" : "linear-gradient(135deg, #0f8ca3, #046276)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: indexing ? "not-allowed" : "pointer",
            transition: "opacity 0.2s",
          }}
        >
          {indexing ? "Indexing... (this may take a few minutes)" : "⚡ Generate Embeddings"}
        </button>
        {indexResult && (
          <p style={{ marginTop: "10px", fontSize: "13px", color: indexResult.startsWith("✅") ? "#0f8ca3" : "#c00" }}>
            {indexResult}
          </p>
        )}
      </div>

      {/* Topics */}
      {r.topics.length > 0 && (
        <div className="repo-detail-topics">
          <h3 className="repo-detail-section-title">Topics</h3>
          <div className="repo-detail-topics-list">
            {r.topics.map((topic) => (
              <span key={topic} className="repo-detail-topic-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="repo-detail-meta-item">
      <div className="repo-detail-meta-icon">{icon}</div>
      <div>
        <div className="repo-detail-meta-label">{label}</div>
        <div className="repo-detail-meta-value">{value}</div>
      </div>
    </div>
  );
}