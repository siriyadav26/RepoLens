// ================================================================
// Documentation Export — Phase 8
// ================================================================

import type { ExportFormat, GeneratedDocument } from "./types";

export function exportDocument(
  document: GeneratedDocument,
  format: ExportFormat
): string {
  switch (format) {
    case "markdown":
      return document.content;
    case "text":
      return markdownToPlainText(document.content);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function markdownToPlainText(md: string): string {
  let text = md;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split("\n");
    const codeLines = lines.slice(1, -1);
    return codeLines.map((l) => `  ${l}`).join("\n");
  });

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Convert headers
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (match, h) =>
    h.toUpperCase()
  );

  // Convert bold/italic
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");

  // Convert links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");

  // Convert blockquotes
  text = text.replace(/^>\s+(.+)$/gm, "  $1");

  // Convert horizontal rules
  text = text.replace(/^---+$/gm, "─".repeat(40));

  // Clean up multiple blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export function getExportFilename(
  document: GeneratedDocument,
  format: ExportFormat
): string {
  const slug = document.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const ext = format === "markdown" ? "md" : "txt";
  return `${slug}.${ext}`;
}