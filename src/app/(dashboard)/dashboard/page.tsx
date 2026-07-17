"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [repoCount, setRepoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          id: user.id,
          email: user.email ?? "",
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
        });

        // Fetch repo count via API
        try {
          const res = await fetch("/api/repositories");
          if (res.ok) {
            const data = await res.json();
            const repos = data.repositories || data;
            setRepoCount(Array.isArray(repos) ? repos.length : 0);
          }
        } catch {}
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !user) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#0f8ca3",
        fontFamily: "monospace",
        fontSize: "16px",
      }}>
        Loading dashboard...
      </div>
    );
  }

  return <DashboardContent user={user} repoCount={repoCount} />;
}