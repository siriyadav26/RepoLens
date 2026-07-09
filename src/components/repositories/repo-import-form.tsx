"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, AlertCircle, ArrowRight } from "lucide-react";

export function RepoImportForm() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Please enter a repository URL or owner/repo name.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/repositories/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }

      // Navigate to the imported repo detail page
      router.push(`/dashboard/repositories/${data.repository.id}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="import-form-wrapper">
      <form onSubmit={handleSubmit} className="import-form">
        <div className="import-input-group">
          <div className="import-input-icon-wrap">
            <Search size={18} className="import-input-icon" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. vercel/next.js or https://github.com/vercel/next.js"
            className="import-input"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="import-submit-btn"
          >
            {loading ? (
              <Loader2 size={18} className="import-spinner" />
            ) : (
              <>
                <span className="import-btn-text">Import</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="import-error fade-in">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}