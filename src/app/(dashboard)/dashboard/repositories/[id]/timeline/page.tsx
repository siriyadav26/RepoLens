"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  GitCommit,
  Users,
  Calendar,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DailyLineChart,
  WeeklyBarChart,
  ContributorPieChart,
} from "@/components/timeline/activity-chart";
import { TimelineCommitList } from "@/components/timeline/commit-list";
import type { CommitItem } from "@/components/timeline/commit-detail-sheet";

// ── Types ────────────────────────────────────────────────────────
interface ContributorData {
  name: string;
  login: string | null;
  avatar: string | null;
  count: number;
}

interface TimelineData {
  totalCommits: number;
  firstCommitDate: string | null;
  lastCommitDate: string | null;
  commitsPerDay: { date: string; count: number }[];
  commitsPerWeek: { week: string; count: number }[];
  contributors: ContributorData[];
  latestCommits: CommitItem[];
}

interface RepoInfo {
  id: string;
  full_name: string;
  name: string;
  default_branch: string;
}

// ── Summary Card ─────────────────────────────────────────────────
function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="tl-summary-card">
      <div className="tl-summary-icon">{icon}</div>
      <div className="tl-summary-body">
        <div className="tl-summary-label">{label}</div>
        <div className="tl-summary-value">{value}</div>
        {sub && <div className="tl-summary-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Loading skeletons ─────────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div className="tl-page">
      <div className="tl-summary-row">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="tl-summary-card">
            <Skeleton className="tl-skel-icon" />
            <div className="tl-summary-body">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-6 w-14" />
            </div>
          </div>
        ))}
      </div>
      <div className="tl-charts-grid">
        <Skeleton className="tl-skel-chart" />
        <Skeleton className="tl-skel-chart" />
      </div>
      <Skeleton className="tl-skel-chart" />
      <div className="tl-commits-section">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="tl-commit-item tl-skel-commit">
            <Skeleton className="tl-skel-avatar" />
            <div style={{ flex: 1 }}>
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────
function TimelineEmpty({ repoId }: { repoId: string }) {
  return (
    <div className="tl-big-empty">
      <TrendingUp size={48} className="tl-big-empty-icon" />
      <h2 className="tl-big-empty-title">No Timeline Data</h2>
      <p className="tl-big-empty-sub">
        Import commits from the Commit History page to visualise the timeline.
      </p>
      <Link
        href={`/dashboard/repositories/${repoId}/commits`}
        className="tl-big-empty-btn"
      >
        <GitCommit size={15} />
        Go to Commit History
      </Link>
    </div>
  );
}

// ── Format helpers ────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Page ─────────────────────────────────────────────────────────
export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/repositories/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/repositories/${id}/timeline`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([repoRes, timelineRes]) => {
        setRepo(repoRes?.repository ?? null);
        setData(timelineRes ?? null);
      })
      .catch(() => setError("Failed to load timeline."))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="repo-page">
        <nav className="page-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="page-breadcrumb-sep">/</span>
          <Link href="/dashboard/repositories">Repositories</Link>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">Commit Timeline</span>
        </nav>
        <div className="tl-page-header">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <TimelineSkeleton />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="repo-page">
        <nav className="page-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="page-breadcrumb-sep">/</span>
          <Link href="/dashboard/repositories">Repositories</Link>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">Commit Timeline</span>
        </nav>
        <div className="tl-big-empty">
          <p style={{ color: "#ef4444" }}>{error}</p>
        </div>
      </div>
    );
  }

  const isEmpty = !data || data.totalCommits === 0;

  return (
    <div className="repo-page">
      {/* Breadcrumb */}
      <nav className="page-breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href="/dashboard/repositories">Repositories</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href={`/dashboard/repositories/${id}`}>{repo?.name ?? "Repository"}</Link>
        <span className="page-breadcrumb-sep">/</span>
        <span className="page-breadcrumb-current">Commit Timeline</span>
      </nav>

      {/* Page header */}
      <div className="tl-page-header">
        <div className="tl-page-header-left">
          <TrendingUp size={22} className="tl-page-header-icon" />
          <div>
            <h1 className="repo-page-title">Commit Timeline</h1>
            <p className="repo-page-subtitle">
              {repo?.full_name ?? "—"} — {repo?.default_branch ?? "main"}
            </p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <TimelineEmpty repoId={id} />
      ) : (
        <div className="tl-page">
          {/* ── Summary Cards ── */}
          <div className="tl-summary-row">
            <SummaryCard
              icon={<GitCommit size={18} />}
              label="Total Commits"
              value={data.totalCommits.toLocaleString()}
            />
            <SummaryCard
              icon={<Users size={18} />}
              label="Contributors"
              value={data.contributors.length.toLocaleString()}
            />
            <SummaryCard
              icon={<Calendar size={18} />}
              label="First Commit"
              value={fmtDate(data.firstCommitDate)}
            />
            <SummaryCard
              icon={<Clock size={18} />}
              label="Last Commit"
              value={fmtDate(data.lastCommitDate)}
            />
          </div>

          {/* ── Activity Charts ── */}
          <div className="tl-charts-grid">
            <DailyLineChart data={data.commitsPerDay} />
            <WeeklyBarChart data={data.commitsPerWeek} />
          </div>

          {/* ── Contributor Pie ── */}
          {data.contributors.length > 0 && (
            <div className="tl-single-chart">
              <ContributorPieChart data={data.contributors} />
            </div>
          )}

          {/* ── Commit List ── */}
          <TimelineCommitList commits={data.latestCommits} />
        </div>
      )}
    </div>
  );
}
