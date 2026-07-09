"use client";

import type { AIAnalysis } from "@/lib/health/types";

interface AnalysisSectionProps {
  analysis: AIAnalysis;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchHighlights: string[];
}

export function AnalysisSection({ analysis, searchTerm, onSearchChange, searchHighlights }: AnalysisSectionProps) {
  return (
    <div className="health-analysis">
      {/* Summary */}
      <div className="health-analysis-block">
        <h3 className="health-analysis-title">AI Health Summary</h3>
        <p className="health-analysis-summary">{analysis.summary}</p>
      </div>

      {/* Search */}
      <div className="health-search-bar">
        <input
          type="text"
          placeholder="Search risks, recommendations, hotspots..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="health-search-input"
        />
      </div>

      {/* Search Results */}
      {searchTerm && searchHighlights.length > 0 && (
        <div className="health-search-results">
          <h4>Matching Results</h4>
          {searchHighlights.map((h, i) => (
            <div key={i} className="health-search-result-item">{h}</div>
          ))}
        </div>
      )}

      <div className="health-analysis-grid">
        {/* Debt Concerns */}
        <div className="health-analysis-block concern">
          <h3 className="health-analysis-title">
            <span className="health-analysis-icon warning">!</span>
            Technical Debt Concerns
          </h3>
          <ul className="health-analysis-list">
            {analysis.debtConcerns.map((c, i) => (
              <li key={i} className={searchTerm && c.toLowerCase().includes(searchTerm.toLowerCase()) ? "highlighted" : ""}>{c}</li>
            ))}
            {analysis.debtConcerns.length === 0 && <li className="health-empty-mini">No concerns identified</li>}
          </ul>
        </div>

        {/* Unstable Areas */}
        <div className="health-analysis-block unstable">
          <h3 className="health-analysis-title">
            <span className="health-analysis-icon danger">!</span>
            Unstable Areas
          </h3>
          <ul className="health-analysis-list">
            {analysis.unstableAreas.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
            {analysis.unstableAreas.length === 0 && <li className="health-empty-mini">No instability detected</li>}
          </ul>
        </div>

        {/* Maintenance Risks */}
        <div className="health-analysis-block risk">
          <h3 className="health-analysis-title">
            <span className="health-analysis-icon warning">!</span>
            Maintenance Risks
          </h3>
          <ul className="health-analysis-list">
            {analysis.maintenanceRisks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            {analysis.maintenanceRisks.length === 0 && <li className="health-empty-mini">No significant risks</li>}
          </ul>
        </div>

        {/* Refactoring Priorities */}
        <div className="health-analysis-block refactor">
          <h3 className="health-analysis-title">
            <span className="health-analysis-icon info">→</span>
            Refactoring Priorities
          </h3>
          <ul className="health-analysis-list">
            {analysis.refactoringPriorities.map((p, i) => (
              <li key={i}><strong>{i + 1}.</strong> {p}</li>
            ))}
            {analysis.refactoringPriorities.length === 0 && <li className="health-empty-mini">No priorities identified</li>}
          </ul>
        </div>

        {/* Positive Practices */}
        <div className="health-analysis-block positive">
          <h3 className="health-analysis-title">
            <span className="health-analysis-icon success">✓</span>
            Positive Engineering Practices
          </h3>
          <ul className="health-analysis-list">
            {analysis.positivePractices.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
            {analysis.positivePractices.length === 0 && <li className="health-empty-mini">No specific practices identified</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}