"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderGit2, LogOut } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Repositories", href: "/dashboard/repositories", icon: FolderGit2 },
];

export function GlobalNav() {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav className="global-nav">
      <div className="global-nav-inner">
        {/* Logo / Brand */}
        <Link href="/dashboard" className="global-nav-brand">
          <svg width="26" height="26" viewBox="0 0 200 200" fill="none">
            <defs>
              <linearGradient id="gnG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#046276" />
                <stop offset="100%" stopColor="#0f8ca3" />
              </linearGradient>
            </defs>
            <circle cx="85" cy="85" r="45" stroke="url(#gnG)" strokeWidth="12" fill="rgba(4,98,118,0.08)" />
            <text x="85" y="95" textAnchor="middle" fontFamily="monospace" fontSize="42" fontWeight="bold" fill="url(#gnG)">&lt;/&gt;</text>
            <line x1="118" y1="118" x2="152" y2="152" stroke="url(#gnG)" strokeWidth="14" strokeLinecap="round" />
            <circle cx="150" cy="60" r="13" fill="url(#gnG)" />
            <text x="150" y="66" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="bold" fill="#fff">AI</text>
          </svg>
          <span className="global-nav-brand-name">
            RepoLens <strong>AI</strong>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="global-nav-links">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`global-nav-link ${isActive(href) ? "global-nav-link-active" : ""}`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button
          className="global-nav-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <span className="dash-spinner" style={{ width: 14, height: 14 }} />
          ) : (
            <LogOut size={15} />
          )}
          <span className="global-nav-logout-text">Sign out</span>
        </button>
      </div>
    </nav>
  );
}
