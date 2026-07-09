"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data, error: err }) => {
        if (err || !data.user) {
          setUser(null);
        } else {
          setUser({ id: data.user.id, email: data.user.email ?? "" });
        }
        setChecked(true);
      })
      .catch(() => {
        setError(true);
        setChecked(true);
      });
  }, []);

  if (!checked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#0f8ca3",
          fontFamily: "monospace",
          fontSize: "16px",
        }}
      >
        Checking authentication...
      </div>
    );
  }

  if (error || !user) {
    // Show a sign-in prompt instead of redirecting (prevents redirect loops)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e0e0e0",
          fontFamily: "system-ui, sans-serif",
          gap: "16px",
        }}
      >
        <div
          style={{
            fontSize: "48px",
            marginBottom: "8px",
          }}
        >
          🔐
        </div>
        <h2 style={{ color: "#fff", margin: 0 }}>Session Expired</h2>
        <p style={{ color: "#888", margin: 0 }}>
          Please sign in to continue.
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            marginTop: "12px",
            padding: "12px 32px",
            background: "linear-gradient(135deg, #046276, #0f8ca3)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  return <>{children}</>;
}