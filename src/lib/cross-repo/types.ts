// ================================================================
// Cross-Repository Intelligence Types — Phase 12
// ================================================================

// --- Repository Selection ---
export interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  language: string | null;
  description: string | null;
  stars: number;
  forks: number;
  topics: string[];
  defaultBranch: string;
  totalCommits: number;
  activeContributors: number;
  totalAdditions: number;
  totalDeletions: number;
}

// --- Comparison Types ---
export type ComparisonType = "full" | "architecture" | "tech_stack" | "similarity" | "contributors" | "custom";

// --- Quantitative Metrics Per Repo ---
export interface RepoMetrics {
  repositoryId: string;
  repositoryName: string;
  language: string | null;
  totalCommits: number;
  activeContributors: number;
  totalAdditions: number;
  totalDeletions: number;
  avgCommitSize: number;
  commitsPerWeek: number;
  uniqueFiles: number;
  topContributors: { login: string; name: string; count: number; percentage: number }[];
  commitFrequency: { period: string; count: number }[];
}

// --- Technology Stack ---
export interface TechStack {
  repositoryId: string;
  repositoryName: string;
  languages: { name: string; percentage: number }[];
  frameworks: string[];
  packageManagers: string[];
  buildTools: string[];
  databases: string[];
  deploymentTools: string[];
  detectedFrom: string[]; // which files/patterns led to detection
}

export interface TechComparison {
  shared: string[];
  onlyInA: string[];
  onlyInB: string[];
  allTechnologies: string[];
}

// --- Similarity ---
export interface SimilarityScore {
  repositoryIdA: string;
  repositoryIdB: string;
  overallScore: number; // 0-1
  sharedConcepts: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  reasoning: string;
  breakdown: {
    language: number;
    topic: number;
    commitPattern: number;
    contributor: number;
  };
}

// --- Contributor Comparison ---
export interface ContributorComparison {
  totalContributorsA: number;
  totalContributorsB: number;
  sharedContributors: { login: string; name: string; commitsA: number; commitsB: number }[];
  uniqueToA: { login: string; name: string; commits: number }[];
  uniqueToB: { login: string; name: string; commits: number }[];
  activityComparison: { name: string; avgCommitsA: number; avgCommitsB: number }[];
}

// --- Cross-Repo Search ---
export interface CrossRepoSearchParams {
  query: string;
  repositoryIds?: string[];
  language?: string;
  owner?: string;
  since?: string;
  until?: string;
  topic?: string;
  limit?: number;
}

export interface CrossRepoSearchResult {
  repositoryId: string;
  repositoryName: string;
  commitId: string;
  sha: string;
  message: string;
  authorName: string;
  committedDate: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  similarity: number | null;
}

// --- AI Analysis ---
export interface CrossRepoAIAnalysis {
  executiveSummary: string;
  architecturalComparison: string;
  sharedPatterns: string[];
  keyDifferences: string[];
  bestPractices: string[];
  recommendations: string[];
  similarityExplanation: string;
  technologyInsights: string;
  contributorInsights: string;
}

// --- Report ---
export interface CrossRepoReport {
  id: string;
  userId: string;
  repositoryIds: string[];
  repositoryNames: string[];
  comparisonType: ComparisonType;
  metrics: RepoMetrics[];
  techStacks: TechStack[];
  similarity: SimilarityScore | null;
  contributorComparison: ContributorComparison | null;
  techComparison: TechComparison | null;
  aiAnalysis: CrossRepoAIAnalysis | null;
  reportMarkdown: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// --- Dashboard State ---
export interface CrossRepoDashboardData {
  repositories: RepoSummary[];
  selectedIds: string[];
  metrics: RepoMetrics[];
  techStacks: TechStack[];
  similarity: SimilarityScore | null;
  contributorComparison: ContributorComparison | null;
  techComparison: TechComparison | null;
  searchResults: CrossRepoSearchResult[];
  aiAnalysis: CrossRepoAIAnalysis | null;
  report: CrossRepoReport | null;
  previousReports: { id: string; repositoryNames: string[]; comparisonType: string; createdAt: string }[];
}

export type ExportFormat = "markdown" | "text";