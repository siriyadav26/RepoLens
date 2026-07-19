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
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
        {/* Nav buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Link href={`/dashboard/repositories/${r.id}/commits`} className="repo-detail-commits-btn">
            <GitCommit size={15} /><span>Commits</span>
          </Link>
          <Link href={`/dashboard/repositories/${r.id}/timeline`} className="repo-detail-commits-btn">
            <TrendingUp size={15} /><span>Timeline</span>
          </Link>
          <Link href={`/dashboard/repositories/${r.id}/analysis`} className="repo-detail-commits-btn">
            <Sparkles size={15} /><span>AI Analysis</span>
          </Link>
          <Link href={`/dashboard/repositories/${r.id}/documentation`} className="repo-detail-commits-btn">
            <FileText size={15} /><span>Docs</span>
          </Link>
          <Link href={`/dashboard/repositories/${r.id}/health`} className="repo-detail-commits-btn">
            <Activity size={15} /><span>Health</span>
          </Link>
          <Link href={`/dashboard/repositories/${r.id}/evolution-arch`} className="repo-detail-commits-btn">
            <Network size={15} /><span>Architecture</span>
          </Link>
          <Link href={`/dashboard/repositories/${r.id}/chat`} className="repo-detail-commits-btn">
            <Sparkles size={15} /><span>RAG Q&amp;A</span>
          </Link>
        </div>

        {/* Embed bar — inline styled for reliability */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
          padding: "16px 20px",
          background: "#f0fdf9",
          border: "1px solid #a7f3d0",
          borderLeft: "4px solid #0f8ca3",
          borderRadius: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "24px", lineHeight: 1 }}>⚡</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                RAG Embeddings
              </p>
              <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
                Index this repository to enable AI Q&amp;A
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {indexResult && (
              <span style={{
                fontSize: "12px",
                fontWeight: 500,
                padding: "4px 10px",
                borderRadius: "6px",
                background: indexResult.startsWith("✅") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                color: indexResult.startsWith("✅") ? "#065f46" : "#991b1b",
                border: indexResult.startsWith("✅") ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(239,68,68,0.25)",
              }}>
                {indexResult}
              </span>
            )}
            <button
              onClick={handleGenerateEmbeddings}
              disabled={indexing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 20px",
                background: indexing ? "#94a3b8" : "linear-gradient(135deg, #0f8ca3, #046276)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: indexing ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "opacity 0.2s",
              }}
            >
              {indexing ? "⏳ Indexing..." : "⚡ Generate Embeddings"}
            </button>
          </div>
        </div>
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