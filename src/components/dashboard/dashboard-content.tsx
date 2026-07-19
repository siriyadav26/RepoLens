"use client";

import Link from "next/link";
import {
  FolderGit2,
  Zap,
  GitCommit,
  Brain,
  MessageSquare,
  FileText,
  Activity,
  Network,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Sparkles,
  ChevronRight,
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

const HOW_TO_STEPS = [
  {
    step: 1,
    icon: FolderGit2,
    title: "Import a Repository",
    desc: "Go to Repositories and connect any public or private GitHub repo. RepoLens pulls the metadata and stores it for analysis.",
    href: "/dashboard/repositories",
    action: "Go to Repositories",
  },
  {
    step: 2,
    icon: Zap,
    title: "Generate Embeddings",
    desc: "Open a repository and click \"Generate Embeddings\". This indexes all your code files locally using AI — no external API needed.",
    href: "/dashboard/repositories",
    action: "Pick a repo",
  },
  {
    step: 3,
    icon: MessageSquare,
    title: "Ask Questions (RAG Q&A)",
    desc: "Once indexed, use the RAG Q&A chat to ask natural language questions about your codebase. Answers are grounded strictly in your files.",
    href: "/dashboard/repositories",
    action: "Try it",
  },
  {
    step: 4,
    icon: Brain,
    title: "Run AI Analysis",
    desc: "Get AI-powered architecture overviews, tech stack detection, quality scores, and code health reports for any repository.",
    href: "/dashboard/repositories",
    action: "Explore",
  },
];

const FEATURES = [
  {
    icon: GitCommit,
    title: "Commit Timeline",
    desc: "Visualise daily/weekly commit activity, contributor breakdowns, and velocity charts.",
    color: "#f59e0b",
  },
  {
    icon: Brain,
    title: "AI Code Analysis",
    desc: "Architecture overview, tech stack badges, and AI quality scores powered by Groq LLaMA.",
    color: "#8b5cf6",
  },
  {
    icon: MessageSquare,
    title: "RAG Q&A",
    desc: "Ask questions about your code. Strictly repository-grounded — no hallucinations.",
    color: "#0f8ca3",
  },
  {
    icon: FileText,
    title: "AI Documentation",
    desc: "Auto-generate and version documentation for any repository with one click.",
    color: "#10b981",
  },
  {
    icon: Activity,
    title: "Code Health",
    desc: "Debt scores, test coverage indicators, and actionable improvement suggestions.",
    color: "#ef4444",
  },
  {
    icon: Network,
    title: "Architecture View",
    desc: "Understand module dependencies, layer structure, and architectural patterns.",
    color: "#06b6d4",
  },
];

export function DashboardContent({ user, repoCount = 0 }: DashboardContentProps) {
  const initials = user.email.split("@")[0].slice(0, 2).toUpperCase();
  const joined = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="home-page">
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-avatar">{initials}</div>
          <div>
            <h1 className="home-hero-title">
              Welcome back, <span className="home-hero-name">{user.email.split("@")[0]}</span> 👋
            </h1>
            <p className="home-hero-sub">
              Member since {joined} &nbsp;·&nbsp; {repoCount} {repoCount === 1 ? "repository" : "repositories"} connected
            </p>
          </div>
        </div>
        <Link href="/dashboard/repositories" className="home-hero-cta">
          <FolderGit2 size={16} />
          My Repositories
          <ArrowRight size={14} />
        </Link>
      </section>

      {/* ── About RepoLens AI ── */}
      <section className="home-section">
        <div className="home-section-label">
          <BookOpen size={14} />
          About
        </div>
        <h2 className="home-section-title">What is RepoLens AI?</h2>
        <div className="home-about-grid">
          <div className="home-about-card">
            <Sparkles size={22} className="home-about-icon" />
            <h3 className="home-about-card-title">AI-Powered Code Intelligence</h3>
            <p className="home-about-card-desc">
              RepoLens AI is a developer tool that connects to your GitHub repositories and
              gives you deep, AI-powered insights — from architecture analysis to natural
              language Q&A about your codebase.
            </p>
          </div>
          <div className="home-about-card">
            <CheckCircle2 size={22} className="home-about-icon home-about-icon--green" />
            <h3 className="home-about-card-title">Strictly Repository-Grounded</h3>
            <p className="home-about-card-desc">
              The RAG Q&A system only answers from your actual indexed files using local
              embeddings — no hallucinations, no general knowledge leakage. Everything is
              grounded in your real code.
            </p>
          </div>
          <div className="home-about-card">
            <Zap size={22} className="home-about-icon home-about-icon--yellow" />
            <h3 className="home-about-card-title">Local Embeddings, No API Key</h3>
            <p className="home-about-card-desc">
              Code indexing uses <code className="home-code">all-MiniLM-L6-v2</code> running
              locally on your machine via <code className="home-code">@xenova/transformers</code>.
              Your code never leaves your environment during indexing.
            </p>
          </div>
        </div>
      </section>

      {/* ── How to Use ── */}
      <section className="home-section">
        <div className="home-section-label">
          <BookOpen size={14} />
          Guide
        </div>
        <h2 className="home-section-title">How to Get Started</h2>
        <div className="home-steps">
          {HOW_TO_STEPS.map(({ step, icon: Icon, title, desc, href, action }) => (
            <div key={step} className="home-step">
              <div className="home-step-number">{step}</div>
              <div className="home-step-connector" />
              <div className="home-step-card">
                <div className="home-step-icon-wrap">
                  <Icon size={18} />
                </div>
                <div className="home-step-body">
                  <h3 className="home-step-title">{title}</h3>
                  <p className="home-step-desc">{desc}</p>
                  <Link href={href} className="home-step-link">
                    {action} <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Overview ── */}
      <section className="home-section">
        <div className="home-section-label">
          <Sparkles size={14} />
          Features
        </div>
        <h2 className="home-section-title">Everything Inside a Repository</h2>
        <p className="home-section-sub">
          All features are accessible from any repository detail page. Import a repo to unlock them.
        </p>
        <div className="home-features-grid">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="home-feat">
              <div className="home-feat-icon" style={{ color }}>
                <Icon size={20} />
              </div>
              <div>
                <h4 className="home-feat-title">{title}</h4>
                <p className="home-feat-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className="home-section home-section--last">
        <div className="home-quick-actions">
          <Link href="/dashboard/repositories" className="home-qa-btn home-qa-btn--primary">
            <FolderGit2 size={16} />
            View My Repositories
          </Link>
          <Link href="/dashboard/repositories" className="home-qa-btn">
            <Zap size={16} />
            Import New Repository
          </Link>
          <Link href="/dashboard/ai-dashboard" className="home-qa-btn">
            <Activity size={16} />
            AI Engineering Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}