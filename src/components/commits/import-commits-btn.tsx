"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";

interface ImportCommitsBtnProps {
  repositoryId: string;
  existingCount: number;
}

export function ImportCommitsBtn({ repositoryId, existingCount }: ImportCommitsBtnProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(isRefresh: boolean) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/repositories/${repositoryId}/commits/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxPages: isRefresh ? 1 : 3,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.setupRequired) {
          setError("Commits table not set up. Run scripts/create-commits-table.sql in Supabase SQL Editor.");
        } else {
          setError(data.error || "Import failed.");
        }
        return;
      }

      setResult({ imported: data.imported, message: data.message });

      // Reload page data after short delay
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="commit-import-area">
      <div className="commit-import-buttons">
        <button
          onClick={() => handleImport(false)}
          disabled={loading}
          className="commit-import-btn"
        >
          {loading ? (
            <span className="dash-spinner" />
          ) : (
            <Download size={16} />
          )}
          {existingCount > 0 ? "Import More Commits" : "Import Commits"}
        </button>

        {existingCount > 0 && (
          <button
            onClick={() => handleImport(true)}
            disabled={loading}
            className="commit-refresh-btn"
          >
            {loading ? <span className="dash-spinner" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        )}
      </div>

      {result && (
        <div className="commit-import-result fade-in">
          {result.message}
        </div>
      )}

      {error && (
        <div className="commit-import-error fade-in">
          {error}
        </div>
      )}
    </div>
  );
}