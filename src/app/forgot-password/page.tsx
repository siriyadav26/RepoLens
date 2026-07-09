"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function RepoLensLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="lensG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#046276" />
          <stop offset="100%" stopColor="#0f8ca3" />
        </linearGradient>
        <linearGradient id="ringG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#046276" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f8ca3" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="90" stroke="url(#ringG)" strokeWidth="4" fill="none" />
      <circle cx="85" cy="85" r="45" stroke="url(#lensG)" strokeWidth="7" fill="rgba(4,98,118,0.06)" />
      <text x="85" y="93" textAnchor="middle" fontFamily="monospace" fontSize="36" fontWeight="bold" fill="url(#lensG)">
        &lt;/&gt;
      </text>
      <line x1="118" y1="118" x2="155" y2="155" stroke="url(#lensG)" strokeWidth="10" strokeLinecap="round" />
      <circle cx="152" cy="60" r="12" fill="url(#lensG)" />
      <text x="152" y="65" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="bold" fill="#fff">
        AI
      </text>
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationError(undefined);

    if (!email.trim()) {
      setValidationError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError("Please enter a valid email");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <div className="auth-card" style={{ height: "420px" }}>
        {/* Orbs */}
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />

        {/* Brand */}
        <div className="auth-brand auth-brand-left show">
          <RepoLensLogo className="auth-brand-icon" />
          <span className="auth-brand-text">RepoLens <strong>AI</strong></span>
        </div>

        <div className="auth-form-wrapper">
          {submitted ? (
            <div className="auth-form" style={{ alignItems: "center", textAlign: "center" }}>
              <div style={{ marginBottom: "8px" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "fadeIn 0.4s ease both" }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="auth-title">Check Your Email</h2>
              <p style={{ color: "#777", fontSize: "13.5px", lineHeight: "1.5", margin: "4px 0 16px" }}>
                If an account exists for <strong>{email}</strong>, you will
                receive a password reset link shortly.
              </p>
              <Link href="/" className="auth-switch">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <h2 className="auth-title">Forgot Password</h2>
              <p className="auth-subtitle">We&apos;ll send you a reset link</p>

              {error && <div className="error-msg fade-in">{error}</div>}

              <div className="auth-field">
                <input
                  type="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationError) setValidationError(undefined);
                  }}
                  className={validationError ? "input-error" : ""}
                  disabled={loading}
                  autoComplete="email"
                  id="fp-email"
                />
                <label htmlFor="fp-email">Email</label>
              </div>
              {validationError && (
                <div className="validation-msg fade-in">{validationError}</div>
              )}

              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <span className="spinner" /> : "SEND RESET LINK"}
              </button>

              <Link href="/" className="auth-switch" style={{ textAlign: "center", display: "block" }}>
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}