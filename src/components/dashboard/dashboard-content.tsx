"use client";

import { FeatureCard } from "@/components/dashboard/feature-card";
import {
  ChevronRight,
  FolderGit2,
  Clock,
  Brain,
  Search,
  Activity,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface DashboardContentProps {
  user: User;
  repoCount?: number;
}

export function DashboardContent({ user, repoCount = 0 }: DashboardContentProps) {
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const initials = user.email.split("@")[0].slice(0, 2).toUpperCase();

  return (
    <div className="dash-page">
      {/* ── Main content ── */}
      <main className="dash-main">
        {/* Welcome */}
        <section className="dash-welcome dash-stagger" style={{ animationDelay: "0.1s" }}>
          <h1 className="dash-welcome-title">
            Welcome back<span className="dash-wave">👋</span>
          </h1>
          <p className="dash-welcome-sub">
            Here&apos;s your RepoLens AI dashboard. Explore the features below.
          </p>
        </section>

        {/* User Info Bar */}
        <section className="dash-user-bar dash-stagger" style={{ animationDelay: "0.2s" }}>
          <div className="dash-user-bar-left">
            <div className="dash-avatar dash-avatar-lg">{initials}</div>
            <div>
              <div className="dash-user-bar-name">{user.email}</div>
              <div className="dash-user-bar-meta">
                <span>Joined {formatDate(user.created_at)}</span>
                <span className="dash-dot" />
                <span>
                  {user.last_sign_in_at
                    ? `Last active ${formatDateTime(user.last_sign_in_at)}`
                    : "First time signing in"}
                </span>
              </div>
            </div>
          </div>
          <div className="dash-user-bar-right">
            <div className="dash-stat">
              <span className="dash-stat-value">{repoCount}</span>
              <span className="dash-stat-label">Repos</span>
            </div>
            <div className="dash-stat-divider" />
            <div className="dash-stat">
              <span className="dash-stat-value">0</span>
              <span className="dash-stat-label">Analyses</span>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="dash-features-section">
          <div className="dash-features-header dash-stagger" style={{ animationDelay: "0.3s" }}>
            <h2 className="dash-features-title">
              Features
              <ChevronRight size={18} className="dash-features-chevron" />
            </h2>
            <span className="dash-features-badge">1 new</span>
          </div>

          <div className="dash-features-grid">
            <div className="dash-stagger" style={{ animationDelay: "0.35s" }}>
              <FeatureCard
                title="Repository Import"
                description="Import and connect your GitHub repositories for deep analysis and tracking."
                icon={FolderGit2}
                badge="Core"
                href="/dashboard/repositories"
              />
            </div>
            <div className="dash-stagger" style={{ animationDelay: "0.42s" }}>
              <FeatureCard
                title="Commit Timeline"
                description="View commit history, daily/weekly charts, and contributor breakdowns. Open from any repository page."
                icon={Clock}
                badge="History"
                href="/dashboard/repositories"
                status="available"
                actionLabel="Pick a repo →"
              />
            </div>
            <div className="dash-stagger" style={{ animationDelay: "0.49s" }}>
              <FeatureCard
                title="AI Code Analysis"
                description="Architecture overview, tech stack detection, and AI-powered quality scores. Open from any repository page."
                icon={Brain}
                badge="AI"
                href="/dashboard/repositories"
                status="available"
                actionLabel="Pick a repo →"
              />
            </div>
            <div className="dash-stagger" style={{ animationDelay: "0.56s" }}>
              <FeatureCard
                title="RAG Q&A"
                description="Ask natural language questions about your code using retrieval-augmented generation."
                icon={Search}
                badge="Smart Search"
              />
            </div>
            <div className="dash-stagger" style={{ animationDelay: "0.63s" }}>
              <FeatureCard
                title="AI Engineering Dashboard"
                description="Monitor LLM usage, RAG performance, provider health, and system observability."
                icon={Activity}
                badge="Observability"
                href="/dashboard/ai-dashboard"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}