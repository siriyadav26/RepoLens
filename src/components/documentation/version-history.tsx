"use client";

import { useState } from "react";
import type { DocumentVersion } from "@/lib/documentation/types";
import { Clock, RotateCcw } from "lucide-react";

interface VersionHistoryProps {
  versions: DocumentVersion[];
  currentVersion: number;
  onRestore: (versionId: string) => void;
  onCompare: (versionId: string) => void;
  restoring: boolean;
}

export function VersionHistory({
  versions,
  currentVersion,
  onRestore,
  onCompare,
  restoring,
}: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (versions.length === 0) {
    return (
      <div className="version-history-empty">
        No version history available.
      </div>
    );
  }

  return (
    <div className="version-history">
      <button
        className="version-history-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Clock size={14} />
        <span>Version History ({versions.length})</span>
        <span className="version-history-arrow">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="version-history-list">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`version-history-item ${v.version === currentVersion ? "active" : ""}`}
            >
              <div className="version-history-info">
                <span className="version-history-num">v{v.version}</span>
                <span className="version-history-date">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
                <span className="version-history-model">
                  {v.provider}/{v.model}
                </span>
              </div>
              <div className="version-history-actions">
                {v.version !== currentVersion && (
                  <>
                    <button
                      className="version-history-btn compare"
                      onClick={() => onCompare(v.id)}
                      title="Compare with current"
                    >
                      Compare
                    </button>
                    <button
                      className="version-history-btn restore"
                      onClick={() => onRestore(v.id)}
                      disabled={restoring}
                      title="Restore this version"
                    >
                      <RotateCcw size={13} /> Restore
                    </button>
                  </>
                )}
                {v.version === currentVersion && (
                  <span className="version-history-current">Current</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}