"use client";

import { useState, useMemo } from "react";
import type { EvolutionMetrics, AIArchitectureSummary, TimePeriod, Milestone } from "@/lib/evolution/types";
import { DependencyGraph } from "./dependency-graph";
import { MarkdownRenderer } from "@/components/documentation/markdown-renderer";
import { RefreshCw, Download, FileBarChart, Search, GitBranch, Box, Zap } from "lucide-react";

interface Props {
  repositoryId: string;
}

export function EvolutionDashboard({ repositoryId }: Props) {
  const [metrics, setMetrics] = useState<EvolutionMetrics | null>(null);
  const [aiSummary, setAiSummary] = useState<AIArchitectureSummary | null>(null);
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "folders" | "modules" | "graph" | "milestones">("timeline");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/evolution-arch`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMetrics(data.metrics);
      if (data.cachedSummary) setAiSummary(data.cachedSummary);
      if (data.cachedReport) setReportMd(data.cachedReport);
    } catch { setError("Failed to load evolution data."); }
    finally { setLoading(false); }
  };

  useState(() => { fetchData(); });

  const runAnalysis = async () => {
    setAnalyzing(true); setError(null);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/evolution-arch`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
      if (data.aiSummary) setAiSummary(data.aiSummary);
      if (data.report?.reportMarkdown) setReportMd(data.report.reportMarkdown);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setAnalyzing(false); }
  };

  const handleExport = (fmt: "markdown" | "text") => {
    if (!reportMd) return;
    const content = fmt === "text" ? reportMd.replace(/#{1,6}\s+(.+)$/gm, "$1").replace(/\*\*/g, "").replace(/`/g, "") : reportMd;
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `evolution-report.${fmt === "markdown" ? "md" : "txt"}`;
    a.click();
  };

  // Filtered data
  const filteredMilestones = useMemo(() => {
    if (!searchTerm || !metrics) return [];
    const q = searchTerm.toLowerCase();
    return metrics.milestones.filter(
      (m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    );
  }, [searchTerm, metrics]);

  if (loading) return <div className="health-loading"><span className="dash-spinner" /> Computing evolution...</div>;
  if (error && !metrics) return <div className="health-error"><p>{error}</p><button className="doc-generate-btn" onClick={fetchData}><RefreshCw size={14} /> Retry</button></div>;
  if (!metrics) return null;
  const noData = metrics.totalCommits === 0;

  return (
    <div className="evol-dashboard">
      {/* Header */}
      <div className="health-header">
        <div>
          <h1 className="health-title">Architecture Evolution</h1>
          <p className="health-subtitle">{noData ? "Import commits first" : `${metrics.totalCommits} commits over ${metrics.timeSpanDays} days`}</p>
        </div>
        <div className="health-header-actions">
          <select className="doc-filter-select" value={period} onChange={(e) => setPeriod(e.target.value as TimePeriod)}>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
          <button className="doc-generate-btn" onClick={runAnalysis} disabled={analyzing || noData}>
            <RefreshCw size={14} className={analyzing ? "spin" : ""} /> {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </button>
          {reportMd && (<>
            <button className="doc-action-btn" onClick={() => setShowReport(!showReport)}><FileBarChart size={14} /> {showReport ? "Dashboard" : "Report"}</button>
            <button className="doc-action-btn" onClick={() => handleExport("markdown")}><Download size={14} /> .md</button>
            <button className="doc-action-btn" onClick={() => handleExport("text")}><Download size={14} /> .txt</button>
          </>)}
        </div>
      </div>

      {noData ? <div className="doc-empty"><Box size={48} className="doc-empty-icon" /><h3>No commit data</h3><p>Import commits to enable evolution analysis.</p></div> : showReport && reportMd ? (
        <div className="health-report-view"><MarkdownRenderer content={reportMd} /></div>
      ) : (<>
        {/* Search */}
        <div className="doc-filters">
          <div className="doc-search"><Search size={15} className="doc-search-icon" /><input type="text" placeholder="Search milestones, modules, folders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="doc-search-input" /></div>
        </div>

        {/* Search Results */}
        {searchTerm && (
          <div className="evol-search-results">
            {filteredMilestones.length > 0 ? filteredMilestones.map((m) => (
              <div key={m.id} className="evol-search-item"><strong>{m.title}</strong><span>{new Date(m.date).toLocaleDateString()}</span><span>{m.description.slice(0, 80)}</span></div>
            )) : <div className="health-empty-mini">No results found.</div>}
          </div>
        )}

        {/* Tabs */}
        <div className="commit-tabs">
          {(["timeline", "folders", "modules", "graph", "milestones"] as const).map((tab) => (
            <button key={tab} className={`commit-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Timeline Tab */}
        {activeTab === "timeline" && <TimelineView metrics={metrics} period={period} />}

        {/* Folders Tab */}
        {activeTab === "folders" && <FoldersView folders={metrics.folders} />}

        {/* Modules Tab */}
        {activeTab === "modules" && <ModulesView modules={metrics.modules} />}

        {/* Graph Tab */}
        {activeTab === "graph" && <DependencyGraph nodes={metrics.graphNodes} edges={metrics.graphEdges} />}

        {/* Milestones Tab */}
        {activeTab === "milestones" && <MilestonesView milestones={metrics.milestones} />}

        {/* AI Summary */}
        {aiSummary && (
          <div className="evol-ai-section">
            <h3 className="health-section-title"><Zap size={16} /> AI Architecture Summary</h3>
            <p className="evol-ai-overview">{aiSummary.evolutionOverview}</p>
            <div className="health-analysis-grid">
              {aiSummary.structuralChanges.length > 0 && <AnalysisBlock title="Structural Changes" items={aiSummary.structuralChanges} color="#f59e0b" />}
              {aiSummary.activeSubsystems.length > 0 && <AnalysisBlock title="Active Subsystems" items={aiSummary.activeSubsystems} color="#0f8ca3" />}
              {aiSummary.stableComponents.length > 0 && <AnalysisBlock title="Stable Components" items={aiSummary.stableComponents} color="#10b981" />}
              {aiSummary.growthAreas.length > 0 && <AnalysisBlock title="Growth Areas" items={aiSummary.growthAreas} color="#8b5cf6" />}
              {aiSummary.architecturalRisks.length > 0 && <AnalysisBlock title="Architectural Risks" items={aiSummary.architecturalRisks} color="#ef4444" />}
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

function TimelineView({ metrics, period }: { metrics: EvolutionMetrics; period: TimePeriod }) {
  const data = useMemo(() => {
    if (period === "month") return metrics.timeline;
    // Rebuild for different periods
    return metrics.timeline; // metrics.ts builds monthly by default, switching handled via API
  }, [metrics, period]);

  const maxVal = Math.max(...data.map((p) => p.commits), 1);

  return (
    <div className="health-section">
      <h3 className="health-section-title">Repository Growth Timeline</h3>
      <div className="evol-timeline-chart">
        {data.map((p) => (
          <div key={p.period} className="evol-timeline-bar-group">
            <div className="evol-timeline-bars">
              <div className="evol-timeline-bar-wrap" title={`${p.commits} commits`}>
                <div className="evol-timeline-bar commits" style={{ height: `${(p.commits / maxVal) * 100}%` }} />
              </div>
              <div className="evol-timeline-bar-wrap" title={`+${p.additions} additions`}>
                <div className="evol-timeline-bar additions" style={{ height: `${(p.additions / (Math.max(...data.map((d) => d.additions), 1))) * 100}%` }} />
              </div>
            </div>
            <div className="evol-timeline-label">{p.label}</div>
          </div>
        ))}
      </div>
      <div className="evol-timeline-legend">
        <span className="evol-legend-item commits" /> Commits
        <span className="evol-legend-item additions" /> Additions
      </div>
    </div>
  );
}

function FoldersView({ folders }: { folders: EvolutionMetrics["folders"] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="health-section">
      <h3 className="health-section-title">Folder / Branch Evolution</h3>
      <div className="evol-folder-list">
        {folders.length === 0 ? <div className="health-empty-mini">No folder data</div> : folders.map((f) => (
          <div key={f.path} className="evol-folder-item">
            <div className="evol-folder-header" onClick={() => setExpanded(expanded === f.path ? null : f.path)}>
              <GitBranch size={14} />
              <span className="evol-folder-path">{f.path}</span>
              <span className="evol-folder-stat">{f.totalCommits} commits</span>
              <span className="evol-folder-activity">Activity: {f.activityScore}%</span>
              <span className="evol-folder-arrow">{expanded === f.path ? "▲" : "▼"}</span>
            </div>
            {expanded === f.path && (
              <div className="evol-folder-details">
                <div>Created: {new Date(f.created).toLocaleDateString()}</div>
                <div>Last Modified: {new Date(f.lastModified).toLocaleDateString()}</div>
                <div>Total Additions: +{f.totalAdditions} | Deletions: -{f.totalDeletions}</div>
                <div>Contributors: {f.contributors}</div>
                <div>Growth Rate: {f.growthRate} lines/week</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModulesView({ modules }: { modules: EvolutionMetrics["modules"] }) {
  const [sort, setSort] = useState<"active" | "least" | "recent" | "freq">("active");
  const sorted = useMemo(() => {
    const arr = [...modules];
    switch (sort) {
      case "active": return arr.sort((a, b) => b.commitCount - a.commitCount);
      case "least": return arr.sort((a, b) => a.commitCount - b.commitCount);
      case "recent": return arr.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
      case "freq": return arr.sort((a, b) => b.changeFrequency - a.changeFrequency);
    }
  }, [modules, sort]);

  return (
    <div className="health-section">
      <div className="evol-modules-header">
        <h3 className="health-section-title">Module Evolution</h3>
        <select className="doc-filter-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="active">Most Active</option>
          <option value="least">Least Active</option>
          <option value="recent">Recently Modified</option>
          <option value="freq">Highest Frequency</option>
        </select>
      </div>
      <div className="evol-module-list">
        {sorted.length === 0 ? <div className="health-empty-mini">No module data</div> : sorted.map((m) => (
          <div key={m.name} className="evol-module-item">
            <div className="evol-module-name">{m.name}</div>
            <div className="evol-module-stats">
              <span>{m.commitCount} commits</span>
              <span>{m.contributors.length} contributors</span>
              <span>{m.changeFrequency}/week</span>
              <span>+{m.totalAdditions} -{m.totalDeletions}</span>
            </div>
            <div className="evol-module-dates">
              {new Date(m.created).toLocaleDateString()} → {new Date(m.lastModified).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestonesView({ milestones }: { milestones: Milestone[] }) {
  const typeColors: Record<string, string> = {
    project_creation: "#10b981", feature_addition: "#0f8ca3", major_refactor: "#f59e0b",
    large_cluster: "#f97316", reorganization: "#8b5cf6", milestone: "#6366f1",
  };

  return (
    <div className="health-section">
      <h3 className="health-section-title">Milestones</h3>
      <div className="evol-milestone-list">
        {milestones.length === 0 ? <div className="health-empty-mini">No milestones detected</div> : milestones.map((m) => (
          <div key={m.id} className="evol-milestone-item">
            <div className="evol-milestone-dot" style={{ background: typeColors[m.type] || "#9ca3af" }} />
            <div className="evol-milestone-content">
              <div className="evol-milestone-title">{m.title}</div>
              <div className="evol-milestone-desc">{m.description}</div>
              <div className="evol-milestone-meta">
                <span>{new Date(m.date).toLocaleDateString()}</span>
                <span style={{ color: typeColors[m.type] }}>{m.type.replace(/_/g, " ")}</span>
                <span>Significance: {m.significance}/10</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="health-analysis-block" style={{ borderLeftColor: color }}>
      <h3 className="health-analysis-title">{title}</h3>
      <ul className="health-analysis-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}