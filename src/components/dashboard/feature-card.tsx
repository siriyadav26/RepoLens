import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  href?: string;
  status?: "available" | "planned";
  actionLabel?: string;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  badge,
  href,
  status = "planned",
  actionLabel,
}: FeatureCardProps) {
  const isAvailable = status === "available" || !!href;

  const inner = (
    <>
      {/* Top accent bar */}
      <div className="feat-card-accent" />

      <div className="feat-card-body">
        {/* Icon + Category badge */}
        <div className="feat-card-top">
          <div className="feat-card-icon-wrap">
            <Icon size={22} className="feat-card-icon" />
          </div>
          <span className="feat-card-phase">{badge}</span>
        </div>

        {/* Text */}
        <h3 className="feat-card-title">{title}</h3>
        <p className="feat-card-desc">{description}</p>

        {/* Footer */}
        <div className="feat-card-footer">
          <span className="feat-card-status">
            <span
              className="feat-card-dot"
              style={{
                background: isAvailable ? "#16a34a" : undefined,
              }}
            />
            {isAvailable ? (actionLabel || "Available") : "Coming Soon"}
          </span>
          {isAvailable && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="feat-card-arrow"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        <div className="feat-card">{inner}</div>
      </Link>
    );
  }

  return <div className="feat-card">{inner}</div>;
}