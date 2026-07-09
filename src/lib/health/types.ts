// ================================================================
// Health Types — Phase 9: Technical Debt & Code Health Analyzer
// ================================================================

export interface HealthScores {
  overall: number;
  technicalDebt: number;
  maintainability: number;
  risk: number;
  stability: number;
  documentation: number;
}

export interface Hotspot {
  path: string;
  changeCount: number;
  totalAdditions: number;
  totalDeletions: number;
  lastModified: string;
  contributors: number;
  avgSize: number;
}

export interface DirectoryActivity {
  path: string;
  changeCount: number;
  totalAdditions: number;
  totalDeletions: number;
  fileCount: number;
}

export interface CommitPattern {
  week: string;
  count: number;
  avgSize: number;
  largeCommits: number;
}

export interface ContributorActivity {
  login: string;
  name: string;
  commitCount: number;
  percentage: number;
  firstSeen: string;
  lastSeen: string;
}

export interface HealthMetrics {
  scores: HealthScores;
  hotspots: Hotspot[];
  directoryActivity: DirectoryActivity[];
  commitPatterns: CommitPattern[];
  contributorActivity: ContributorActivity[];
  totalCommits: number;
  totalFiles: number;
  avgCommitSize: number;
  largeCommitCount: number;
  largeCommitPercentage: number;
  timeSpanDays: number;
  commitsPerWeek: number;
  uniqueFiles: number;
  uniqueContributors: number;
}

export interface AIAnalysis {
  summary: string;
  debtConcerns: string[];
  unstableAreas: string[];
  maintenanceRisks: string[];
  refactoringPriorities: string[];
  positivePractices: string[];
  scoreExplanations: Record<string, string>;
}

export interface HealthReport {
  id: string;
  repositoryId: string;
  userId: string;
  scores: HealthScores;
  metrics: HealthMetrics;
  analysis: AIAnalysis | null;
  reportMarkdown: string | null;
  version: number;
  createdAt: string;
}

export type TimelinePeriod = "week" | "month" | "quarter";

export interface TimelineDataPoint {
  period: string;
  scores: HealthScores;
  commitCount: number;
}