"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence, easeOut } from "framer-motion";

/* ── Inline RepoLens AI logo SVG ── */
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

/* ── Two-phase flip variants ── */
const flipOut = {
  initial: { rotateY: 0, opacity: 1, scale: 1 },
  exit: {
    rotateY: 90,
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.35 },
  },
};

const flipIn = {
  initial: { rotateY: -90, opacity: 0, scale: 0.95 },
  animate: {
    rotateY: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: easeOut },
  },
};

export default function AuthCard() {
  const [isSignIn, setIsSignIn] = useState(true);

  // Sign In fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up fields
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  function clearMessages() {
    setError(null);
    setValidationErrors({});
  }

  function clearFieldError(field: string) {
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // --- Validation ---
  function validateLogin(): boolean {
    const errors: Record<string, string> = {};

    if (!loginEmail.trim()) {
      errors.loginEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      errors.loginEmail = "Please enter a valid email";
    }

    if (!loginPassword) {
      errors.loginPassword = "Password is required";
    } else if (loginPassword.length < 6) {
      errors.loginPassword = "Password must be at least 6 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateSignup(): boolean {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (!signupEmail.trim()) {
      errors.signupEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
      errors.signupEmail = "Please enter a valid email";
    }

    if (!signupPassword) {
      errors.signupPassword = "Password is required";
    } else if (signupPassword.length < 6) {
      errors.signupPassword = "Password must be at least 6 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // --- Handlers ---
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!validateLogin()) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Full page navigation so server reads fresh cookies
      window.location.href = "/dashboard";
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!validateSignup()) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError("Account created! Please check your email to verify your account before logging in.");
        setLoading(false);
        return;
      }

      // Email confirmation is off — go straight to dashboard
      window.location.href = "/dashboard";
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  function handleToggle() {
    clearMessages();
    setLoginEmail("");
    setLoginPassword("");
    setFullName("");
    setSignupEmail("");
    setSignupPassword("");
    setIsSignIn((prev) => !prev);
  }

  return (
    <div className="auth-card" style={{ perspective: 1200 }}>
      {/* Animated gradient orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      {/* Floating particles */}
      <div className="auth-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="auth-particle"
            style={{
              left: `${10 + (i * 7.2) % 80}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + (i % 4)}s`,
              width: `${3 + (i % 3)}px`,
              height: `${3 + (i % 3)}px`,
            }}
          />
        ))}
      </div>

      {/* Brand logo — always visible */}
      <div className={`auth-brand ${isSignIn ? "auth-brand-left" : "auth-brand-right"} show`}>
        <RepoLensLogo className="auth-brand-icon" />
        <span className="auth-brand-text">RepoLens <strong>AI</strong></span>
      </div>

      {/* Flip animation container */}
      <AnimatePresence mode="wait">
        {isSignIn ? (
          <motion.div
            className="auth-form-wrapper"
            key="signin"
            variants={({ ...flipOut, ...flipIn } as any)}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ perspective: 1200 }}
          >
            <form className="auth-form" onSubmit={handleLogin}>
              <h2 className="auth-title">Welcome Back</h2>
              <p className="auth-subtitle">Sign in to continue</p>

              {error && <div className="error-msg fade-in">{error}</div>}

              <div className="auth-field-group">
                <div className="auth-field">
                  <input
                    type="email"
                    placeholder=" "
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); clearFieldError("loginEmail"); }}
                    className={validationErrors.loginEmail ? "input-error" : ""}
                    disabled={loading}
                    autoComplete="email"
                    id="si-email"
                  />
                  <label htmlFor="si-email">Email</label>
                </div>
                {validationErrors.loginEmail && (
                  <div className="validation-msg fade-in">{validationErrors.loginEmail}</div>
                )}

                <div className="auth-field">
                  <input
                    type="password"
                    placeholder=" "
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); clearFieldError("loginPassword"); }}
                    className={validationErrors.loginPassword ? "input-error" : ""}
                    disabled={loading}
                    autoComplete="current-password"
                    id="si-pass"
                  />
                  <label htmlFor="si-pass">Password</label>
                </div>
                {validationErrors.loginPassword && (
                  <div className="validation-msg fade-in">{validationErrors.loginPassword}</div>
                )}
              </div>

              <div className="auth-forgot-row">
                <Link href="/forgot-password" className="auth-forgot">
                  Forgot Password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <span className="spinner" /> : (
                  <>
                    <span>LOGIN</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </>
                )}
              </button>

              <div className="auth-switch-row">
                <span className="auth-switch-label">Don&apos;t have an account?</span>
                <span className="auth-switch" onClick={handleToggle}>Register</span>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            className="auth-form-wrapper"
            key="signup"
            variants={({ ...flipOut, ...flipIn } as any)}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ perspective: 1200 }}
          >
            <form className="auth-form" onSubmit={handleSignup}>
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">Get started with RepoLens AI</p>

              {error && <div className="error-msg fade-in">{error}</div>}

              <div className="auth-field-group">
                <div className="auth-field">
                  <input
                    type="text"
                    placeholder=" "
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName"); }}
                    className={validationErrors.fullName ? "input-error" : ""}
                    disabled={loading}
                    autoComplete="name"
                    id="su-name"
                  />
                  <label htmlFor="su-name">Full Name</label>
                </div>
                {validationErrors.fullName && (
                  <div className="validation-msg fade-in">{validationErrors.fullName}</div>
                )}

                <div className="auth-field">
                  <input
                    type="email"
                    placeholder=" "
                    value={signupEmail}
                    onChange={(e) => { setSignupEmail(e.target.value); clearFieldError("signupEmail"); }}
                    className={validationErrors.signupEmail ? "input-error" : ""}
                    disabled={loading}
                    autoComplete="email"
                    id="su-email"
                  />
                  <label htmlFor="su-email">Email</label>
                </div>
                {validationErrors.signupEmail && (
                  <div className="validation-msg fade-in">{validationErrors.signupEmail}</div>
                )}

                <div className="auth-field">
                  <input
                    type="password"
                    placeholder=" "
                    value={signupPassword}
                    onChange={(e) => { setSignupPassword(e.target.value); clearFieldError("signupPassword"); }}
                    className={validationErrors.signupPassword ? "input-error" : ""}
                    disabled={loading}
                    autoComplete="new-password"
                    id="su-pass"
                  />
                  <label htmlFor="su-pass">Password</label>
                </div>
                {validationErrors.signupPassword && (
                  <div className="validation-msg fade-in">{validationErrors.signupPassword}</div>
                )}
              </div>

              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <span className="spinner" /> : (
                  <>
                    <span>CREATE ACCOUNT</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

              <div className="auth-switch-row">
                <span className="auth-switch-label">Already have an account?</span>
                <span className="auth-switch" onClick={handleToggle}>Sign In</span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}