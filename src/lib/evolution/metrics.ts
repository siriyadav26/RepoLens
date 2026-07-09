// ================================================================
// Evolution Metrics Engine — Phase 10
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type {
  TimePeriod,
  TimelinePoint,
  FolderInfo,
  ModuleInfo,
  Milestone,
  MilestoneType,
  ContributorTimeline,
  GraphNode,
  GraphEdge,
  EvolutionMetrics,
} from "./types";

interface CommitRow {
  sha: string;
  message: string | null;
  author_name: string;
  author_login: string | null;
  committed_date: string;
  additions: number;
  deletions: number;
  files_changed: number;
  branch: string;
}

export async function computeEvolutionMetrics(
  repositoryId: string,
  userId: string
): Promise<EvolutionMetrics> {
  const supabase = await createClient();
  const { data: commits, error } = await supabase
    .from("commits")
    .select("sha, message, author_name, author_login, committed_date, additions, deletions, files_changed, branch")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("committed_date", { ascending: true });

  if (error || !commits || commits.length === 0) return emptyMetrics();

  const totalCommits = commits.length;
  const dates = commits.map((c) => new Date(c.committed_date).getTime());
  const timeSpanDays = Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000));
  const uniqueContributors = new Set(commits.map((c) => c.author_login || c.author_name).filter(Boolean)).size;

  const milestones = detectMilestones(commits);
  const timeline = buildTimeline(commits, "month");
  const folders = buildFolderEvolution(commits);
  const modules = buildModuleEvolution(commits);
  const contributorTimeline = buildContributorTimeline(commits, "month");
  const { nodes, edges } = buildDependencyGraph(folders, modules);

  return {
    timeline,
    folders,
    modules,
    milestones,
    contributorTimeline,
    graphNodes: nodes,
    graphEdges: edges,
    totalCommits,
    timeSpanDays,
    uniqueContributors,
  };
}

export function buildTimeline(
  commits: CommitRow[],
  period: TimePeriod
): TimelinePoint[] {
  const map = new Map<string, { commits: number; additions: number; deletions: number; files: number; contributors: Set<string> }>();

  for (const c of commits) {
    const key = getPeriodKey(new Date(c.committed_date), period);
    const existing = map.get(key) || { commits: 0, additions: 0, deletions: 0, files: 0, contributors: new Set<string>() };
    existing.commits++;
    existing.additions += c.additions ?? 0;
    existing.deletions += c.deletions ?? 0;
    existing.files += c.files_changed ?? 0;
    existing.contributors.add(c.author_login || c.author_name);
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([period2, data]) => ({
      period: period2,
      label: formatPeriodLabel(period2, period),
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
      filesChanged: data.files,
      contributors: data.contributors.size,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function getPeriodKey(date: Date, period: TimePeriod): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  if (period === "year") return `${y}`;
  if (period === "month") return `${y}-${m}`;
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function formatPeriodLabel(key: string, period: TimePeriod): string {
  if (period === "year") return key;
  if (period === "month") {
    const [y, m] = key.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m) - 1]} ${y}`;
  }
  return key.slice(5);
}

function buildFolderEvolution(commits: CommitRow[]): FolderInfo[] {
  const branchMap = new Map<string, {
    commits: number;
    additions: number;
    deletions: number;
    contributors: Set<string>;
    firstSeen: string;
    lastSeen: string;
  }>();

  for (const c of commits) {
    const key = c.branch || "main";
    const existing = branchMap.get(key) || {
      commits: 0, additions: 0, deletions: 0,
      contributors: new Set<string>(), firstSeen: c.committed_date, lastSeen: c.committed_date,
    };
    existing.commits++;
    existing.additions += c.additions ?? 0;
    existing.deletions += c.deletions ?? 0;
    existing.contributors.add(c.author_login || c.author_name);
    if (c.committed_date < existing.firstSeen) existing.firstSeen = c.committed_date;
    if (c.committed_date > existing.lastSeen) existing.lastSeen = c.committed_date;
    branchMap.set(key, existing);
  }

  const maxCommits = Math.max(...Array.from(branchMap.values()).map((v) => v.commits), 1);
  const totalDays = Math.max(1,
    Math.max(...commits.map((c) => new Date(c.committed_date).getTime())) -
    Math.min(...commits.map((c) => new Date(c.committed_date).getTime()))
  ) / 86400000;

  return Array.from(branchMap.entries())
    .map(([path, data]) => {
      const activeDays = Math.max(1, (new Date(data.lastSeen).getTime() - new Date(data.firstSeen).getTime()) / 86400000);
      const growthRate = (data.additions / activeDays) * 7;
      const activityScore = Math.round((data.commits / maxCommits) * 100);
      return {
        path,
        created: data.firstSeen,
        lastModified: data.lastSeen,
        totalCommits: data.commits,
        totalAdditions: data.additions,
        totalDeletions: data.deletions,
        contributors: data.contributors.size,
        activityScore,
        growthRate: Math.round(growthRate * 10) / 10,
        subFolders: [],
      };
    })
    .sort((a, b) => b.totalCommits - a.totalCommits);
}

function buildModuleEvolution(commits: CommitRow[]): ModuleInfo[] {
  const moduleMap = new Map<string, {
    branch: string;
    commits: number;
    additions: number;
    deletions: number;
    contributors: Set<string>;
    firstSeen: string;
    lastSeen: string;
  }>();

  for (const c of commits) {
    // Extract module hints from commit messages
    const msgLower = (c.message || "").toLowerCase();
    let moduleName = extractModuleHint(msgLower, c.branch);

    const existing = moduleMap.get(moduleName) || {
      branch: c.branch,
      commits: 0, additions: 0, deletions: 0,
      contributors: new Set<string>(), firstSeen: c.committed_date, lastSeen: c.committed_date,
    };
    existing.commits++;
    existing.additions += c.additions ?? 0;
    existing.deletions += c.deletions ?? 0;
    existing.contributors.add(c.author_login || c.author_name);
    if (c.committed_date < existing.firstSeen) existing.firstSeen = c.committed_date;
    if (c.committed_date > existing.lastSeen) existing.lastSeen = c.committed_date;
    moduleMap.set(moduleName, existing);
  }

  const totalDays = Math.max(1,
    (Math.max(...commits.map((c) => new Date(c.committed_date).getTime())) -
      Math.min(...commits.map((c) => new Date(c.committed_date).getTime()))) / 86400000
  );

  return Array.from(moduleMap.entries())
    .map(([name, data]) => {
      const activeDays = Math.max(1, (new Date(data.lastSeen).getTime() - new Date(data.firstSeen).getTime()) / 86400000);
      return {
        name,
        branch: data.branch,
        created: data.firstSeen,
        lastModified: data.lastSeen,
        commitCount: data.commits,
        contributors: Array.from(data.contributors),
        totalAdditions: data.additions,
        totalDeletions: data.deletions,
        changeFrequency: Math.round((data.commits / activeDays) * 7 * 10) / 10,
      };
    })
    .sort((a, b) => b.commitCount - a.commitCount);
}

function extractModuleHint(message: string, branch: string): string {
  const patterns = [
    /(?:add|create|implement|build|update|fix|refactor|remove|migrate)\s+(?:the\s+)?(?:`?)([\w\/.-]+?)(?:`?)/i,
    /(?:in|for|to|from)\s+(?:the\s+)?[`"']?([\w\/.-]+?)[`"']?\s/i,
    /(?:module|component|service|feature|package|folder|dir)\s*[:\s]+(\S+)/i,
  ];

  for (const p of patterns) {
    const m = message.match(p);
    if (m && m[1].length > 2 && m[1].length < 60) return m[1];
  }

  return branch || "core";
}

function detectMilestones(commits: CommitRow[]): Milestone[] {
  const milestones: Milestone[] = [];
  if (commits.length === 0) return milestones;

  // First commit = project creation
  const sorted = [...commits].sort((a, b) => a.committed_date.localeCompare(b.committed_date));
  milestones.push({
    id: `ms-${sorted[0].sha.slice(0, 7)}`,
    type: "project_creation",
    title: "Project Created",
    date: sorted[0].committed_date,
    description: sorted[0].message || "Initial commit",
    commitSha: sorted[0].sha,
    significance: 10,
  });

  // Large commit clusters (top 5% by size)
  const sizes = commits.map((c) => (c.additions ?? 0) + (c.deletions ?? 0)).sort((a, b) => b - a);
  const threshold = sizes[Math.floor(sizes.length * 0.05)] || 500;

  const largeCommits = commits
    .filter((c) => (c.additions ?? 0) + (c.deletions ?? 0) > threshold)
    .sort((a, b) => ((b.additions ?? 0) + (b.deletions ?? 0)) - ((a.additions ?? 0) + (a.deletions ?? 0)))
    .slice(0, 5);

  for (const c of largeCommits) {
    const msgLower = (c.message || "").toLowerCase();
    let type: MilestoneType = "large_cluster";
    let title = "Large Commit Cluster";

    if (msgLower.includes("refactor") || msgLower.includes("restructure") || msgLower.includes("reorgani")) {
      type = "major_refactor";
      title = "Major Refactor";
    } else if (msgLower.includes("initial") || msgLower.includes("setup") || msgLower.includes("scaffold")) {
      type = "project_creation";
      title = "Project Setup";
    } else if (msgLower.includes("migrate") || msgLower.includes("move") || msgLower.includes("reorganize")) {
      type = "reorganization";
      title = "Structural Reorganization";
    } else if (msgLower.includes("feature") || msgLower.includes("add") || msgLower.includes("implement")) {
      type = "feature_addition";
      title = "Significant Feature Addition";
    }

    milestones.push({
      id: `ms-${c.sha.slice(0, 7)}`,
      type,
      title,
      date: c.committed_date,
      description: c.message || "",
      commitSha: c.sha,
      significance: Math.min(10, Math.round(((c.additions ?? 0) + (c.deletions ?? 0)) / threshold * 5)),
    });
  }

  // Refactor keywords
  const refactors = commits.filter((c) => {
    const m = (c.message || "").toLowerCase();
    return m.includes("refactor") || m.includes("rewrite") || m.includes("restructure");
  }).slice(0, 3);

  for (const c of refactors) {
    if (milestones.some((ms) => ms.commitSha === c.sha)) continue;
    milestones.push({
      id: `ms-ref-${c.sha.slice(0, 7)}`,
      type: "major_refactor",
      title: "Refactoring Event",
      date: c.committed_date,
      description: c.message || "",
      commitSha: c.sha,
      significance: 7,
    });
  }

  return milestones.sort((a, b) => a.date.localeCompare(b.date));
}

function buildContributorTimeline(
  commits: CommitRow[],
  period: TimePeriod
): ContributorTimeline[] {
  const authorMap = new Map<string, {
    name: string;
    login: string | null;
    periodMap: Map<string, number>;
    firstSeen: string;
    lastSeen: string;
  }>();

  for (const c of commits) {
    const key = c.author_login || c.author_name;
    const periodKey = getPeriodKey(new Date(c.committed_date), period);
    const existing = authorMap.get(key);
    if (existing) {
      existing.periodMap.set(periodKey, (existing.periodMap.get(periodKey) || 0) + 1);
      if (c.committed_date < existing.firstSeen) existing.firstSeen = c.committed_date;
      if (c.committed_date > existing.lastSeen) existing.lastSeen = c.committed_date;
    } else {
      const pm = new Map<string, number>();
      pm.set(periodKey, 1);
      authorMap.set(key, {
        name: c.author_name,
        login: c.author_login,
        periodMap: pm,
        firstSeen: c.committed_date,
        lastSeen: c.committed_date,
      });
    }
  }

  return Array.from(authorMap.values())
    .map((a) => ({
      name: a.name,
      login: a.login || a.name,
      points: Array.from(a.periodMap.entries())
        .map(([p, count]) => ({ period: p, count }))
        .sort((a2, b2) => a2.period.localeCompare(b2.period)),
      totalCommits: a.periodMap.values().reduce((s, v) => s + v, 0),
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    }))
    .sort((a, b) => b.totalCommits - a.totalCommits);
}

function buildDependencyGraph(
  folders: FolderInfo[],
  modules: ModuleInfo[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Root node
  nodes.push({
    id: "root",
    label: "Repository",
    type: "folder",
    activity: 100,
    commits: folders.reduce((s, f) => s + f.totalCommits, 0),
    contributors: folders.reduce((s, f) => s + f.contributors, 0),
  });

  // Folder nodes
  for (const f of folders) {
    nodes.push({
      id: `folder-${f.path}`,
      label: f.path,
      type: "folder",
      activity: f.activityScore,
      commits: f.totalCommits,
      contributors: f.contributors,
    });
    edges.push({
      id: `edge-root-${f.path}`,
      source: "root",
      target: `folder-${f.path}`,
      weight: f.totalCommits,
    });
  }

  // Module nodes (connected to their branch folder)
  const seenModules = new Set<string>();
  for (const m of modules) {
    if (seenModules.has(m.name)) continue;
    seenModules.add(m.name);
    const nodeId = `module-${m.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
    nodes.push({
      id: nodeId,
      label: m.name,
      type: "module",
      activity: Math.min(100, m.changeFrequency * 10),
      commits: m.commitCount,
      contributors: m.contributors.length,
    });
    // Connect to the matching folder or root
    const parentFolder = folders.find((f) => f.path === m.branch);
    const parent = parentFolder ? `folder-${parentFolder.path}` : "root";
    edges.push({
      id: `edge-${parent}-${nodeId}`,
      source: parent,
      target: nodeId,
      weight: m.commitCount,
    });
  }

  return { nodes, edges };
}

function emptyMetrics(): EvolutionMetrics {
  return {
    timeline: [], folders: [], modules: [], milestones: [],
    contributorTimeline: [], graphNodes: [], graphEdges: [],
    totalCommits: 0, timeSpanDays: 0, uniqueContributors: 0,
  };
}