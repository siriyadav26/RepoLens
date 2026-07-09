"use client";

import { useState } from "react";
import type { DocumentType } from "@/lib/documentation/types";
import { DOCUMENT_TYPE_CONFIG, DOCUMENT_TYPES_LIST } from "@/lib/documentation/types";
import { X } from "lucide-react";

interface DocTypeSelectorProps {
  onSelect: (type: DocumentType) => void;
  onClose: () => void;
  generating: boolean;
}

export function DocTypeSelector({ onSelect, onClose, generating }: DocTypeSelectorProps) {
  const [filter, setFilter] = useState("");
  const filtered = DOCUMENT_TYPES_LIST.filter((t) => {
    const config = DOCUMENT_TYPE_CONFIG[t];
    return (
      config.label.toLowerCase().includes(filter.toLowerCase()) ||
      config.description.toLowerCase().includes(filter.toLowerCase())
    );
  });

  return (
    <div className="doc-type-overlay" onClick={onClose}>
      <div className="doc-type-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-type-header">
          <h2>Generate Documentation</h2>
          <button className="doc-type-close" onClick={onClose} disabled={generating}>
            <X size={18} />
          </button>
        </div>

        <div className="doc-type-search">
          <input
            type="text"
            placeholder="Search document types..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="doc-type-input"
            autoFocus
          />
        </div>

        <div className="doc-type-grid">
          {filtered.map((type) => {
            const config = DOCUMENT_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                className="doc-type-card"
                onClick={() => onSelect(type)}
                disabled={generating}
              >
                <div className="doc-type-card-label">{config.label}</div>
                <div className="doc-type-card-desc">{config.description}</div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="doc-type-empty">No matching document types.</div>
          )}
        </div>

        {generating && (
          <div className="doc-type-generating">
            <span className="dash-spinner" /> Generating with AI...
          </div>
        )}
      </div>
    </div>
  );
}