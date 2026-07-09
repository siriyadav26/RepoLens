"use client";

import type { HealthScores } from "@/lib/health/types";

interface ScoreCardProps {
  label: string;
  value: number;
  explanation?: string;
  icon: React.ReactNode;
  color: string;
}

export function ScoreCard({ label, value, explanation, icon, color }: ScoreCardProps) {
  const getGrade = (v: number) => {
    if (v >= 80) return { grade: "A", cls: "health-grade-a" };
    if (v >= 60) return { grade: "B", cls: "health-grade-b" };
    if (v >= 40) return { grade: "C", cls: "health-grade-c" };
    return { grade: "D", cls: "health-grade-d" };
  };

  const { grade, cls } = getGrade(value);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="health-score-card">
      <div className="health-score-card-top">
        <div className="health-score-ring" style={{ "--ring-color": color } as React.CSSProperties}>
          <svg viewBox="0 0 100 100" className="health-score-svg">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className="health-score-circle"
            />
          </svg>
          <div className="health-score-value">
            <span className={cls}>{value}</span>
          </div>
        </div>
        <div className="health-score-meta">
          <div className="health-score-icon">{icon}</div>
          <div className="health-score-label">{label}</div>
          <div className={`health-score-grade ${cls}`}>{grade}</div>
        </div>
      </div>
      {explanation && (
        <div className="health-score-explanation">{explanation}</div>
      )}
    </div>
  );
}

export function ScoreCardsGrid({
  scores,
  explanations,
}: {
  scores: HealthScores;
  explanations?: Record<string, string>;
}) {
  const cards: { key: keyof HealthScores; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "overall", label: "Overall Health", icon: <HeartPulse />, color: "#0f8ca3" },
    { key: "technicalDebt", label: "Technical Debt", icon: <AlertTriangle />, color: "#f59e0b" },
    { key: "maintainability", label: "Maintainability", icon: <Wrench />, color: "#10b981" },
    { key: "risk", label: "Risk Level", icon: <ShieldAlert />, color: "#ef4444" },
    { key: "stability", label: "Stability", icon: <Activity />, color: "#8b5cf6" },
    { key: "documentation", label: "Documentation", icon: <FileTextIcon />, color: "#6366f1" },
  ];

  return (
    <div className="health-scores-grid">
      {cards.map((card) => (
        <ScoreCard
          key={card.key}
          label={card.label}
          value={scores[card.key]}
          explanation={explanations?.[card.key]}
          icon={card.icon}
          color={card.color}
        />
      ))}
    </div>
  );
}

function HeartPulse() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
      <path d="M12 6l-2 4h4l-2 4" />
    </svg>
  );
}

function AlertTriangle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71 -3L13.71 3.86a2 2 0 0 0 -3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function Wrench() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77 -3.77a6 6 0 0 1 -7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1 -3 -3l6.91 -6.91a6 6 0 0 1 7.94 -7.94l-3.76 3.76z" />
    </svg>
  );
}

function ShieldAlert() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8 -4 8 -10V5l-8 -3l-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  );
}

function Activity() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}