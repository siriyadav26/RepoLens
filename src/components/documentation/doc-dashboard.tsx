"use client";

import { useState, useEffect, useCallback } from "react";
import type { GeneratedDocument, DocumentType } from "@/lib/documentation/types";
import { DOCUMENT_TYPE_CONFIG } from "@/lib/documentation/types";
import { DocTypeSelector } from "./doc-type-selector";
import { DocViewer } from "./doc-viewer";
import {
  Plus,
  Search,
  FileText,
  Sparkles,
  Trash2,
  Copy,
} from "lucide-react";

interface DocDashboardProps {
  repositoryId: string;
}

export function DocDashboard({ repositoryId }: DocDashboardProps) {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showSelector, setShowSelector] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(
        `/api/repositories/${repositoryId}/documentation?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [repositoryId, searchTerm, typeFilter]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleGenerate = async (type: DocumentType) => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: type }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowSelector(false);
        setSelectedDoc(data.document);
        fetchDocs();
      } else {
        const data = await res.json();
        alert(data.error || "Generation failed");
      }
    } catch (err) {
      alert("Generation failed. Check console for details.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (docId: string) => {
    setActionLoading(docId);
    try {
      await fetch(`/api/repositories/${repositoryId}/documentation/${docId}`, {
        method: "DELETE",
      });
      setSelectedDoc(null);
      fetchDocs();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (docId: string) => {
    setActionLoading(docId);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/documentation/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      if (res.ok) {
        fetchDocs();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    if (doc.isEdited && !confirm("This document has been edited. Regenerate will create a new version. Continue?")) {
      return;
    }
    setActionLoading(docId);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/documentation/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedDoc(data.document);
        fetchDocs();
      } else {
        const data = await res.json();
        alert(data.error || "Regeneration failed");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = async (docId: string, content: string) => {
    const res = await fetch(`/api/repositories/${repositoryId}/documentation/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", content }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedDoc(data.document);
      fetchDocs();
    }
  };

  const handleRestore = async (docId: string, versionId: string) => {
    try {
      const res = await fetch(
        `/api/repositories/${repositoryId}/documentation/${docId}/restore/${versionId}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedDoc(data.document);
        fetchDocs();
      }
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  // Document detail view
  if (selectedDoc) {
    return (
      <DocViewer
        document={selectedDoc}
        onBack={() => setSelectedDoc(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onRegenerate={handleRegenerate}
        onRestore={handleRestore}
      />
    );
  }

  // Dashboard / list view
  return (
    <div className="doc-dashboard">
      {/* Header */}
      <div className="doc-dashboard-header">
        <div>
          <h1 className="doc-dashboard-title">Documentation</h1>
          <p className="doc-dashboard-subtitle">
            AI-generated documentation for this repository
          </p>
        </div>
        <button
          className="doc-generate-btn"
          onClick={() => setShowSelector(true)}
        >
          <Plus size={16} /> Generate New
        </button>
      </div>

      {/* Filters */}
      <div className="doc-filters">
        <div className="doc-search">
          <Search size={15} className="doc-search-icon" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="doc-search-input"
          />
        </div>
        <select
          className="doc-filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="doc-loading">
          <span className="dash-spinner" /> Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="doc-empty">
          <Sparkles size={48} className="doc-empty-icon" />
          <h3>No documentation generated yet</h3>
          <p>
            Use AI to generate professional documentation from your repository&apos;s
            commit history and metadata.
          </p>
          <button
            className="doc-generate-btn"
            onClick={() => setShowSelector(true)}
          >
            <Plus size={16} /> Generate Your First Doc
          </button>
        </div>
      ) : (
        <div className="doc-list">
          {documents.map((doc) => {
            const config = DOCUMENT_TYPE_CONFIG[doc.documentType];
            return (
              <div
                key={doc.id}
                className="doc-list-card"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="doc-list-card-header">
                  <FileText size={18} className="doc-list-card-icon" />
                  <div className="doc-list-card-info">
                    <h3 className="doc-list-card-title">{doc.title}</h3>
                    <div className="doc-list-card-meta">
                      <span className="doc-list-card-type">{config.label}</span>
                      <span className="doc-list-card-version">v{doc.version}</span>
                      {doc.isEdited && (
                        <span className="doc-list-card-edited">edited</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="doc-list-card-preview">
                  {doc.content.slice(0, 150).replace(/[#*_`]/g, "")}...
                </p>
                <div className="doc-list-card-footer">
                  <span className="doc-list-card-date">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                  <span className="doc-list-card-model">
                    {doc.provider}/{doc.model}
                  </span>
                  <div className="doc-list-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="doc-list-action"
                      onClick={() => handleDuplicate(doc.id)}
                      disabled={actionLoading === doc.id}
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="doc-list-action danger"
                      onClick={() => handleDelete(doc.id)}
                      disabled={actionLoading === doc.id}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Type selector modal */}
      {showSelector && (
        <DocTypeSelector
          onSelect={handleGenerate}
          onClose={() => setShowSelector(false)}
          generating={generating}
        />
      )}
    </div>
  );
}