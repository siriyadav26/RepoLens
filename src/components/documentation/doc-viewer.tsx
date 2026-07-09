"use client";

import { useState, useCallback } from "react";
import type { GeneratedDocument, ExportFormat } from "@/lib/documentation/types";
import { exportDocument, getExportFilename } from "@/lib/documentation/export";
import { MarkdownRenderer } from "./markdown-renderer";
import { VersionHistory } from "./version-history";
import type { DocumentVersion } from "@/lib/documentation/types";
import {
  ArrowLeft,
  Download,
  Pencil,
  RotateCcw,
  Copy,
  Trash2,
  Save,
  X,
  FileText,
} from "lucide-react";

interface DocViewerProps {
  document: GeneratedDocument;
  onBack: () => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onRestore: (docId: string, versionId: string) => void;
}

export function DocViewer({
  document: doc,
  onBack,
  onEdit,
  onDelete,
  onDuplicate,
  onRegenerate,
  onRestore,
}: DocViewerProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareContent, setCompareContent] = useState("");

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      onEdit(doc.id, editContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [doc.id, editContent, onEdit]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const content = exportDocument(doc, format);
      const filename = getExportFilename(doc, format);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [doc]
  );

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this document permanently?")) return;
    setDeleting(true);
    try {
      onDelete(doc.id);
    } finally {
      setDeleting(false);
    }
  }, [doc.id, onDelete]);

  const loadVersions = useCallback(async () => {
    if (versions.length > 0) {
      setShowVersions(!showVersions);
      return;
    }
    try {
      const res = await fetch(
        `/api/repositories/${doc.repositoryId}/documentation/${doc.id}/versions`
      );
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        setShowVersions(true);
      }
    } catch (err) {
      console.error("Failed to load versions:", err);
    }
  }, [doc.repositoryId, doc.id, versions.length, showVersions]);

  const handleRestore = useCallback(
    async (versionId: string) => {
      setRestoring(versionId);
      try {
        await onRestore(doc.id, versionId);
      } finally {
        setRestoring(null);
      }
    },
    [doc.id, onRestore]
  );

  const handleCompare = useCallback(
    (versionId: string) => {
      const version = versions.find((v) => v.id === versionId);
      if (version) {
        setCompareContent(version.content);
        setCompareMode(true);
      }
    },
    [versions]
  );

  const startEditing = () => {
    setEditContent(doc.content);
    setEditing(true);
    setCompareMode(false);
  };

  return (
    <div className="doc-viewer">
      {/* Top bar */}
      <div className="doc-viewer-topbar">
        <button className="doc-viewer-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="doc-viewer-title">
          <FileText size={16} />
          <h2>{doc.title}</h2>
          <span className="doc-viewer-badge">v{doc.version}</span>
          {doc.isEdited && (
            <span className="doc-viewer-edited-badge">edited</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="doc-viewer-actions">
        {!editing && !compareMode && (
          <>
            <button className="doc-action-btn" onClick={startEditing}>
              <Pencil size={14} /> Edit
            </button>
            <button className="doc-action-btn" onClick={() => onRegenerate(doc.id)}>
              <RotateCcw size={14} /> Regenerate
            </button>
            <button className="doc-action-btn" onClick={() => onDuplicate(doc.id)}>
              <Copy size={14} /> Duplicate
            </button>
            <div className="doc-action-divider" />
            <button className="doc-action-btn" onClick={() => handleExport("markdown")}>
              <Download size={14} /> .md
            </button>
            <button className="doc-action-btn" onClick={() => handleExport("text")}>
              <Download size={14} /> .txt
            </button>
            <div className="doc-action-divider" />
            <button className="doc-action-btn" onClick={loadVersions}>
              <FileText size={14} /> Versions
            </button>
            <button
              className="doc-action-btn danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete"}
            </button>
          </>
        )}

        {editing && (
          <>
            <button className="doc-action-btn primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? "Saving..." : "Save"}
            </button>
            <button className="doc-action-btn" onClick={() => setEditing(false)}>
              <X size={14} /> Cancel
            </button>
          </>
        )}

        {compareMode && (
          <button className="doc-action-btn" onClick={() => setCompareMode(false)}>
            <X size={14} /> Close Compare
          </button>
        )}
      </div>

      {/* Version History */}
      {showVersions && (
        <VersionHistory
          versions={versions}
          currentVersion={doc.version}
          onRestore={handleRestore}
          onCompare={handleCompare}
          restoring={restoring !== null}
        />
      )}

      {/* Content */}
      <div className="doc-viewer-content">
        {editing ? (
          <textarea
            className="doc-editor-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
          />
        ) : compareMode ? (
          <div className="doc-compare-grid">
            <div className="doc-compare-panel">
              <div className="doc-compare-label">Current Version</div>
              <MarkdownRenderer content={doc.content} />
            </div>
            <div className="doc-compare-panel">
              <div className="doc-compare-label">Selected Version</div>
              <MarkdownRenderer content={compareContent} />
            </div>
          </div>
        ) : (
          <MarkdownRenderer content={doc.content} />
        )}
      </div>
    </div>
  );
}