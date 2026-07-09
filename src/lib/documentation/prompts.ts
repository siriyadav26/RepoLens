// ================================================================
// Documentation Prompt Templates — Phase 8
// ================================================================

import type { DocumentType } from "./types";

interface PromptInput {
  repoName: string;
  repoFullName: string;
  language: string | null;
  description: string | null;
  defaultBranch: string;
  contextBlock: string;
  totalCommits: number;
}

function systemBase(): string {
  return `You are an expert technical writer. You generate professional developer documentation grounded STRICTLY in the provided repository context.

CRITICAL RULES:
1. Only state information that can be inferred from the provided commit history and repository metadata.
2. If the context is insufficient for a section, explicitly state: "Insufficient data available for this section."
3. Do NOT fabricate APIs, modules, file paths, architecture patterns, or any details not present in or clearly inferable from the context.
4. Output clean, well-structured Markdown.
5. Use proper heading hierarchy (##, ###, etc.).
6. Include code examples ONLY if the commit context directly references specific code patterns.
7. Be concise but comprehensive.`;
}

function repoContext(input: PromptInput): string {
  return `## Repository Context
- **Name**: ${input.repoFullName}
- **Language**: ${input.language ?? "Unknown"}
- **Description**: ${input.description ?? "No description available"}
- **Default Branch**: ${input.defaultBranch}
- **Total Commits Analyzed**: ${input.totalCommits}

${input.contextBlock}`;
}

const PROMPT_BUILDERS: Record<
  DocumentType,
  (input: PromptInput) => { system: string; user: string }
> = {
  readme: (input) => ({
    system: systemBase() + `\n\nGenerate a complete README.md for this repository. Include: project title, badge area, description, features list, installation, usage, contributing guidelines, and license section.`,
    user: `${repoContext(input)}\n\nGenerate a comprehensive README.md for this repository.`,
  }),

  project_overview: (input) => ({
    system: systemBase() + `\n\nGenerate a project overview document. Focus on the project's purpose, goals, target audience, and high-level capabilities.`,
    user: `${repoContext(input)}\n\nGenerate a project overview for this repository.`,
  }),

  architecture_overview: (input) => ({
    system: systemBase() + `\n\nGenerate an architecture overview. Identify architectural patterns, key components, data flow, and design decisions based on the commit history. Use Mermaid diagrams if the context supports it.`,
    user: `${repoContext(input)}\n\nGenerate an architecture overview for this repository.`,
  }),

  folder_structure: (input) => ({
    system: systemBase() + `\n\nGenerate a folder structure explanation. Describe the purpose of each major directory and file pattern you can infer from commit messages and file changes.`,
    user: `${repoContext(input)}\n\nExplain the folder structure of this repository.`,
  }),

  module_summary: (input) => ({
    system: systemBase() + `\n\nGenerate a module summary. Identify distinct modules/packages from the commit history and describe each module's responsibility and key functionality.`,
    user: `${repoContext(input)}\n\nSummarize the modules in this repository.`,
  }),

  api_summary: (input) => ({
    system: systemBase() + `\n\nGenerate an API summary. Identify API endpoints, request/response patterns, authentication, and API design patterns from the commit history.`,
    user: `${repoContext(input)}\n\nSummarize the API design of this repository.`,
  }),

  installation_guide: (input) => ({
    system: systemBase() + `\n\nGenerate a detailed installation guide. Include prerequisites, step-by-step setup, environment configuration, and troubleshooting based on the commit history.`,
    user: `${repoContext(input)}\n\nCreate an installation guide for this repository.`,
  }),

  onboarding_guide: (input) => ({
    system: systemBase() + `\n\nGenerate a developer onboarding guide. Help new developers understand the codebase, setup their environment, understand conventions, and make their first contribution.`,
    user: `${repoContext(input)}\n\nCreate a developer onboarding guide for this repository.`,
  }),

  release_notes: (input) => ({
    system: systemBase() + `\n\nGenerate release notes based on recent commit activity. Group changes by category (features, fixes, breaking changes, etc.).`,
    user: `${repoContext(input)}\n\nGenerate release notes from the recent activity.`,
  }),

  changelog: (input) => ({
    system: systemBase() + `\n\nGenerate a changelog. Organize entries chronologically, grouped by version or time period. Categorize changes as Added, Changed, Fixed, Deprecated, Removed, or Security.`,
    user: `${repoContext(input)}\n\nGenerate a changelog for this repository.`,
  }),

  feature_summary: (input) => ({
    system: systemBase() + `\n\nGenerate a feature summary. Identify all major features from the commit history and describe each one's purpose and implementation.`,
    user: `${repoContext(input)}\n\nSummarize all features of this repository.`,
  }),

  dependency_overview: (input) => ({
    system: systemBase() + `\n\nGenerate a dependency overview. Identify dependencies from the commit history (package additions, updates, removals) and describe their roles.`,
    user: `${repoContext(input)}\n\nProvide a dependency overview for this repository.`,
  }),
};

export function buildDocPrompt(
  documentType: DocumentType,
  input: PromptInput
): { system: string; user: string } {
  const builder = PROMPT_BUILDERS[documentType];
  if (!builder) {
    throw new Error(`No prompt template for document type: ${documentType}`);
  }
  return builder(input);
}

export const PROMPT_VERSION = "1.0.0";