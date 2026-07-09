export { computeEvolutionMetrics, buildTimeline } from "./metrics";
export { runArchitectureAnalysis, generateEvolutionReport, compareEvolution } from "./analysis";
export type {
  TimePeriod, TimelinePoint, FolderInfo, ModuleInfo, Milestone, MilestoneType,
  ContributorTimeline, GraphNode, GraphEdge, EvolutionMetrics,
  AIArchitectureSummary, EvolutionComparison, ComparisonStats, EvolutionReport,
} from "./types";