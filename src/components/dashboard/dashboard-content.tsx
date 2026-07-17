"use client";

import { useState } from "react";
import { FeatureCard } from "@/components/dashboard/feature-card";
import {
  GitFork,
  Clock,
  Brain,
  Search,
  BarChart3,
  LogOut,
  ChevronRight,
  FolderGit2,
  Activity,
} from "lucide-react";

/* ── Inline RepoLens logo for dashboard header ── */
function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 200 200" fill="none" className="dash-logo-icon">
      <defs>
        <linearGradient id="dlG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#046276" />
          <stop offset="100%" stopColor="#0f8ca3" />
        </linearGradient>
      </defs>
      <circle cx="85" cy="85" r="45" stroke="url(#dlG)" strokeWidth="12" fill="rgba(4,98,118,0.06)" />
      <text x="85" y="95" textAnchor="middle" fontFamily="monospace" fontSize="42" fontWeight="bold" fill="url(#dlG)">&lt;/&gt;</text>
      <line x1="118" y1="118" x2="155" y2="155" stroke="url(#dlG)" strokeWidth="14" strokeLinecap="round" />
      <circle cx="152" cy="60" r="14" fill="url(#dlG)" />
      <text x="152" y="66" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="bold" fill="#fff">AI</text>
    </svg>
  );
}

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
  const [loading, setLoading] = useState(false);
  const [showLogoutMsg, setShowLogoutMsg] = useState(false);

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

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch("/auth/logout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Logout failed");
      }
      window.location.href = "/";
    } catch {
      setShowLogoutMsg(true);
      setLoading(false);
    }
  }

  const initials = user.email
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="dash-page">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <Logo />
            <span className="dash-brand-name">
              RepoLens <strong>AI</strong>
            </span>
          </div>

          <div className="dash-header-right">
            <div className="dash-user-chip">
              <div className="dash-avatar">{initials}</div>
              <span className="dash-user-email">{user.email}</span>
            </div>

            <button
              className="dash-logout-btn"
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? (
                <span className="dash-spinner" />
              ) : (
                <>
                  <LogOut size={16} />
                  <span className="dash-logout-text">Sign out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="dash-main">
        {showLogoutMsg && (
          <div className="dash-error-bar fade-in">
            Failed to sign out. Please try again.
          </div>
        )}

        {/* Welcome */}
        <section className="dash-welcome dash-stagger" style={{ animationDelay: "0.1s" }}>
          <h1 className="dash-welcome-title">
            Welcome back<span className="dash-wave">👋</span>
          </h1>
          <p className="dash-welcome-sub">
            Here&apos;s your RepoLens AI dashboard. Explore the features coming your way.
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
                description="Import and connect your Git repositories for deep analysis and tracking."
                icon={FolderGit2}
                badge="Core"
                href="/dashboard/repositories"
              />
            </div>
            <div className="dash-stagger" style={{ animationDelay: "0.42s" }}>
              <FeatureCard
                title="Commit Timeline"
                description="Visualize commit history and track how your project evolved over time."
                icon={Clock}
                badge="History"
              />
            </div>
            <div className="dash-stagger" style={{ animationDelay: "0.49s" }}>
              <FeatureCard
                title="AI Code Analysis"
                description="Get AI-powered insights about your codebase architecture and patterns."
                icon={Brain}
                badge="AI Insights"
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