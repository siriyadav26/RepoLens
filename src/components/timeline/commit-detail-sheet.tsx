"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Check,
  ExternalLink,
  GitCommit,
  User,
  Calendar,
  Plus,
  Minus,
  FileCode,
} from "lucide-react";

export interface CommitItem {
  sha: string;
  message: string;
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  committed_date: string;
  additions: number;
  deletions: number;
  files_changed: number;
  commit_url: string | null;
}

interface CommitDetailSheetProps {
  commit: CommitItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommitDetailSheet({
  commit,
  open,
  onOpenChange,
}: CommitDetailSheetProps) {
  const [copied, setCopied] = useState(false);

  function copySha() {
    if (!commit) return;
    navigator.clipboard.writeText(commit.sha).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const messageLines = (commit?.message ?? "").split("\n");
  const title = messageLines[0] || "No commit message";
  const body = messageLines.slice(1).join("\n").trim();

  // Mock changed files based on files_changed count
  const mockFiles: string[] = commit
    ? Array.from({ length: Math.min(commit.files_changed, 8) }, (_, i) => {
        const extensions = [
          "src/components/ui/button.tsx",
          "src/lib/utils.ts",
          "src/app/api/route.ts",
          "src/styles/globals.css",
          "package.json",
          "README.md",
          "src/hooks/useData.ts",
          "prisma/schema.prisma",
        ];
        return extensions[i % extensions.length];
      })
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="tl-sheet-content"
        style={{ width: "min(520px, 100vw)", maxWidth: "100vw" }}
      >
        <SheetHeader className="tl-sheet-header">
          <div className="tl-sheet-header-top">
            <GitCommit size={16} className="tl-sheet-icon" />
            <Badge variant="secondary" className="tl-sheet-sha-badge">
              {commit?.sha.slice(0, 7) ?? ""}
            </Badge>
          </div>
          <SheetTitle className="tl-sheet-title">{title}</SheetTitle>
        </SheetHeader>

        {commit && (
          <ScrollArea className="tl-sheet-body">
            {/* ── SHA row ── */}
            <div className="tl-sheet-section">
              <div className="tl-sheet-row">
                <div className="tl-sheet-row-label">
                  <FileCode size={13} />
                  Full SHA
                </div>
                <div className="tl-sheet-sha-full">
                  <code className="tl-sha-code">{commit.sha}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="tl-copy-btn"
                    onClick={copySha}
                    title="Copy SHA"
                  >
                    {copied ? (
                      <Check size={13} className="tl-copy-check" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              {/* ── Author ── */}
              <div className="tl-sheet-row">
                <div className="tl-sheet-row-label">
                  <User size={13} />
                  Author
                </div>
                <div className="tl-sheet-row-value">
                  {commit.author_avatar && (
                    <img
                      src={commit.author_avatar}
                      alt={commit.author_name}
                      className="tl-sheet-avatar"
                    />
                  )}
                  <span>
                    {commit.author_name}
                    {commit.author_login && (
                      <span className="tl-sheet-login">
                        {" "}
                        @{commit.author_login}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* ── Timestamp ── */}
              <div className="tl-sheet-row">
                <div className="tl-sheet-row-label">
                  <Calendar size={13} />
                  Committed
                </div>
                <div className="tl-sheet-row-value">
                  {formatTimestamp(commit.committed_date)}
                </div>
              </div>
            </div>

            <Separator className="tl-sheet-sep" />

            {/* ── Stats ── */}
            <div className="tl-sheet-stats">
              <div className="tl-sheet-stat tl-stat-add">
                <Plus size={14} />
                <span className="tl-stat-num">{commit.additions}</span>
                <span className="tl-stat-lbl">additions</span>
              </div>
              <div className="tl-sheet-stat tl-stat-del">
                <Minus size={14} />
                <span className="tl-stat-num">{commit.deletions}</span>
                <span className="tl-stat-lbl">deletions</span>
              </div>
              <div className="tl-sheet-stat tl-stat-files">
                <FileCode size={14} />
                <span className="tl-stat-num">{commit.files_changed}</span>
                <span className="tl-stat-lbl">
                  file{commit.files_changed !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <Separator className="tl-sheet-sep" />

            {/* ── Commit message body ── */}
            {body && (
              <>
                <div className="tl-sheet-section">
                  <div className="tl-sheet-section-title">
                    Full Commit Message
                  </div>
                  <pre className="tl-sheet-message-pre">{commit.message}</pre>
                </div>
                <Separator className="tl-sheet-sep" />
              </>
            )}

            {/* ── Changed files ── */}
            {mockFiles.length > 0 && (
              <div className="tl-sheet-section">
                <div className="tl-sheet-section-title">
                  Changed Files
                  {commit.files_changed > 8 && (
                    <span className="tl-files-note">
                      {" "}
                      (showing 8 of {commit.files_changed})
                    </span>
                  )}
                </div>
                <div className="tl-file-list">
                  {mockFiles.map((f, i) => (
                    <div key={i} className="tl-file-item">
                      <FileCode size={12} className="tl-file-icon" />
                      <code className="tl-file-path">{f}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── View on GitHub ── */}
            {commit.commit_url && (
              <div className="tl-sheet-footer">
                <a
                  href={commit.commit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tl-gh-link"
                >
                  <ExternalLink size={14} />
                  View on GitHub
                </a>
              </div>
            )}
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
