// ================================================================
// Documentation Types — Phase 8
// ================================================================

export type DocumentType =
  | "readme"
  | "project_overview"
  | "architecture_overview"
  | "folder_structure"
  | "module_summary"
  | "api_summary"
  | "installation_guide"
  | "onboarding_guide"
  | "release_notes"
  | "changelog"
  | "feature_summary"
  | "dependency_overview";

export const DOCUMENT_TYPE_CONFIG: Record<
  DocumentType,
  { label: string; icon: string; description: string }
> = {
  readme: { label: "README.md", icon: "FileText", description: "Complete README with overview, installation, and usage" },
  project_overview: { label: "Project Overview", icon: "LayoutDashboard", description: "High-level project description and goals" },
  architecture_overview: { label: "Architecture Overview", icon: "Boxes", description: "System architecture, patterns, and design decisions" },
  folder_structure: { label: "Folder Structure", icon: "FolderTree", description: "Explanation of project directory layout" },
  module_summary: { label: "Module Summary", icon: "Package", description: "Summary of each module/package and its responsibility" },
  api_summary: { label: "API Summary", icon: "Code", description: "Endpoints, request/response patterns, and API design" },
  installation_guide: { label: "Installation Guide", icon: "Download", description: "Step-by-step setup and installation instructions" },
  onboarding_guide: { label: "Developer Onboarding", icon: "UserCheck", description: "Guide for new developers joining the project" },
  release_notes: { label: "Release Notes", icon: "Tag", description: "Recent changes and release highlights" },
  changelog: { label: "Changelog", icon: "History", description: "Comprehensive log of all notable changes" },
  feature_summary: { label: "Feature Summary", icon: "Sparkles", description: "List and description of all features" },
  dependency_overview: { label: "Dependency Overview", icon: "GitBranch", description: "Analysis of project dependencies and their roles" },
};

export const DOCUMENT_TYPES_LIST: DocumentType[] = Object.keys(DOCUMENT_TYPE_CONFIG) as DocumentType[];

export interface GeneratedDocument {
  id: string;
  repositoryId: string;
  userId: string;
  title: string;
  documentType: DocumentType;
  content: string;
  version: number;
  promptVersion: string;
  provider: string;
  model: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  promptVersion: string;
  provider: string;
  model: string;
  createdAt: string;
}

export interface GenerateRequest {
  documentType: DocumentType;
  customTitle?: string;
}

export interface GenerateResponse {
  document: GeneratedDocument;
}

export type ExportFormat = "markdown" | "text";