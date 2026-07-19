// ================================================================
// Repository Embedding Pipeline
// GitHub file tree → chunks → local embeddings → Supabase
// ================================================================

// We use the service role client here because:
// 1. Ownership is already verified in the API route before calling this.
// 2. The cookie-based anon client cannot satisfy RLS INSERT policies
//    reliably in long-running server-side functions.
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";
import { generateEmbedding } from "@/lib/ai/embeddings";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase service role credentials not configured");
  return createServiceClient(url, key, {
    auth: { persistSession: false },
  });
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
]);

const IGNORED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "svg", "webp", "avif",
  "mp4", "mp3", "wav", "webm", "ogg",
  "pdf", "zip", "tar", "gz", "rar", "7z",
  "woff", "woff2", "ttf", "eot", "otf",
  "exe", "dll", "so", "dylib", "bin",
  "map",    // source maps
  "pyc", "class",
]);

interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}

function isIgnored(filePath: string): boolean {
  const parts = filePath.split("/");

  // Check every directory segment in the path
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRS.has(parts[i])) return true;
  }

  // Check file extension or specific file names
  const filename = parts[parts.length - 1].toLowerCase();
  
  // Ignore lockfiles & config blobs that aren't useful
  if ([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    ".gitignore",
    ".DS_Store"
  ].includes(filename)) {
    return true;
  }

  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx !== -1) {
    const ext = filename.slice(dotIdx + 1);
    if (IGNORED_EXTENSIONS.has(ext)) return true;
  }

  return false;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "RepoLens-AI/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function embedRepository(repositoryId: string) {
  const supabase = getServiceClient();
  const startTime = Date.now();

  // 1. Look up the repository in Supabase
  const { data: repo, error: repoError } = await supabase
    .from("repositories")
    .select("id, owner_login, name, default_branch")
    .eq("id", repositoryId)
    .single();

  if (repoError || !repo) {
    throw new Error(`Repository not found: ${repositoryId}`);
  }

  const { owner_login: owner, name, default_branch: branch } = repo;

  console.log(`[RAG] Starting indexing for ${owner}/${name} (branch: ${branch})`);

  // 2. Fetch full recursive file tree from GitHub
  const treeUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers: buildHeaders() });

  if (!treeRes.ok) {
    throw new Error(`GitHub tree fetch failed: ${treeRes.status} ${treeRes.statusText}`);
  }

  const treeData = await treeRes.json();

  const allBlobs = (treeData.tree as GitHubTreeItem[]).filter(
    (item) =>
      item.type === "blob" &&
      !isIgnored(item.path) &&
      (item.size ?? 0) < 500_000 // skip files > 500KB
  );

  console.log(`[RAG] Files scanned: ${allBlobs.length} eligible files`);

  // 3. Delete existing embeddings for this repository (re-index clean)
  const { error: deleteError } = await supabase
    .from("file_embeddings")
    .delete()
    .eq("repository_id", repositoryId);

  if (deleteError) {
    console.warn("[RAG] Warning: Failed to delete old embeddings:", deleteError.message);
  } else {
    console.log("[RAG] Old embeddings cleared.");
  }

  let filesIndexed = 0;
  let chunksCreated = 0;
  let embeddingsStored = 0;

  // 4. Process each file
  for (const file of allBlobs) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${file.path}`;
      const rawRes = await fetch(rawUrl, { headers: buildHeaders() });

      if (!rawRes.ok) continue;

      const content = await rawRes.text();
      if (!content.trim()) continue;

      const chunks = chunkText(content, 800, 100);
      if (chunks.length === 0) continue;

      filesIndexed++;
      chunksCreated += chunks.length;

      // 5. Embed and insert each chunk
      const rowsToInsert: {
        repository_id: string;
        file_path: string;
        content: string;
        embedding: number[];
      }[] = [];

      for (const chunk of chunks) {
        const prefixedText = `File: ${file.path}\n\n${chunk}`;
        const embedding = await generateEmbedding(prefixedText);
        rowsToInsert.push({
          repository_id: repositoryId,
          file_path: file.path,
          content: chunk,
          embedding,
        });
      }

      // Insert in one batch per file
      const { error: insertError } = await supabase
        .from("file_embeddings")
        .insert(rowsToInsert);

      if (insertError) {
        console.error(
          `[RAG] Insert error for ${file.path}:`,
          JSON.stringify(insertError)
        );
      } else {
        embeddingsStored += rowsToInsert.length;
        console.log(
          `[RAG] ${file.path} — ${chunks.length} chunks embedded and stored.`
        );
      }
    } catch (err) {
      console.error(`[RAG] Failed to process ${file.path}:`, err);
    }
  }

  const durationMs = Date.now() - startTime;

  console.log(`[RAG] Done.`);
  console.log(`  Files indexed:      ${filesIndexed}`);
  console.log(`  Chunks created:     ${chunksCreated}`);
  console.log(`  Embeddings stored:  ${embeddingsStored}`);
  console.log(`  Duration:           ${durationMs}ms`);

  return { filesIndexed, chunksCreated, embeddingsStored, durationMs };
}
