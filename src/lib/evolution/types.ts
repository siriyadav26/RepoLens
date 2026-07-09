// ================================================================
// Evolution Types — Phase 10: Architecture Evolution Visualizer
// ================================================================

export type TimePeriod = "week" | "month" | "year";

export interface TimelinePoint {
  period: string;
  label: string;
  commits: number;
  additions: number;
  deletions: number;
  filesChanged: number;
  contributors: number;
}

export interface FolderInfo {
  path: string;
  created: string;
  lastModified: string;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  contributors: number;
  activityScore: number;
  growthRate: number;
  subFolders: string[];
}

export interface ModuleInfo {
  name: string;
  branch: string;
  created: string;
  lastModified: string;
  commitCount: number;
  contributors: string[];
  totalAdditions: number;
  totalDeletions: number;
  changeFrequency: number;
  aiSummary?: string;
}

export type MilestoneType =
  | "project_creation"
  | "feature_addition"
  | "major_refactor"
  | "large_cluster"
  | "reorganization"
  | "milestone";

export interface Milestone {
  id: string;
  type: MilestoneType;
  title: string;
  date: string;
  description: string;
  commitSha: string;
  significance: number; // 1-10
}

export interface ContributorTimeline {
  name: string;
  login: string;
  points: { period: string; count: number }[];
  totalCommits: number;
  firstSeen: string;
  lastSeen: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "folder" | "module" | "branch";
  activity: number;
  commits: number;
  contributors: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

export interface EvolutionMetrics {
  timeline: TimelinePoint[];
  folders: FolderInfo[];
  modules: ModuleInfo[];
  milestones: Milestone[];
  contributorTimeline: ContributorTimeline[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  totalCommits: number;
  timeSpanDays: number;
  uniqueContributors: number;
}

export interface AIArchitectureSummary {
  evolutionOverview: string;
  structuralChanges: string[];
  activeSubsystems: string[];
  stableComponents: string[];
  growthAreas: string[];
  architecturalRisks: string[];
}

export interface EvolutionComparison {
  period1: { start: string; end: string; stats: ComparisonStats };
  period2: { start: string; end: string; stats: ComparisonStats };
  aiSummary: string;
}

export interface ComparisonStats {
  commits: number;
  additions: number;
  deletions: number;
  contributors: number;
  avgCommitSize: number;
  activeFolders: number;
}

export interface EvolutionReport {
  id: string;
  repositoryId: string;
  userId: string;
  aiSummary: AIArchitectureSummary;
  reportMarkdown: string | null;
  version: number;
  createdAt: string;
}