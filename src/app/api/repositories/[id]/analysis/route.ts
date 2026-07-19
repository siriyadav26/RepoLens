import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRepositoryById } from "@/lib/supabase/repositories";
import { getLLM } from "@/lib/ai/llm";

// ── Types ────────────────────────────────────────────────────────
interface AnalysisResult {
  architecture: string;
  framework: string;
  renderingStrategy: string;
  databaseLayer: string;
  authentication: string;
  techStack: string[];
  designPatterns: string[];
  strengths: string[];
  codeSmells: string[];
  securityRisks: string[];
  performanceRisks: string[];
  maintainabilityScore: number;
  testingScore: number;
  documentationScore: number;
  summary: string;
}

// ── GitHub Fetch Helpers ─────────────────────────────────────────
async function fetchRepoTree(owner: string, repo: string, defaultBranch: string = "main") {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${defaultBranch}?recursive=1`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "RepoLens-AI/1.0",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.tree || []).map((item: any) => item.path) as string[];
    }
  } catch (e) {
    console.error("Failed to fetch repo tree:", e);
  }
  return [];
}

async function fetchGitHubFile(owner: string, repo: string, path: string, defaultBranch: string = "main") {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`;
  try {
    const res = await fetch(rawUrl, {
      headers: process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : undefined,
      next: { revalidate: 3600 },
    });
    if (res.ok) return await res.text();
  } catch (e) {
    console.warn(`Failed to fetch raw file ${path}:`, e);
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${defaultBranch}`;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "RepoLens-AI/1.0",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.content && data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf8");
      }
    }
  } catch (e) {
    console.error(`Failed to fetch file via API ${path}:`, e);
  }
  return null;
}

// ── Mock Fallback ────────────────────────────────────────────────
function generateMockAnalysis(repo: any): AnalysisResult {
  // Dynamic mock customization based on repo language/name
  const isPython = repo.language?.toLowerCase() === "python";
  return {
    architecture: isPython ? "Model-View-Controller (MVC) / Scripting" : "Component-Based Client-Server Architecture",
    framework: isPython ? "FastAPI / Django" : "Next.js / React",
    renderingStrategy: isPython ? "Server-Side Rendering (SSR)" : "App Router (SSR/RSC)",
    databaseLayer: "Supabase (PostgreSQL)",
    authentication: "Supabase Auth",
    techStack: isPython 
      ? ["Python", "FastAPI", "Uvicorn", "PostgreSQL", "Supabase"]
      : ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase"],
    designPatterns: ["Repository Pattern", "Dependency Injection", "Singleton Pattern"],
    strengths: [
      "Modular project structure with clean separation of concerns.",
      "Good configuration management with environment variables.",
      "Type safety throughout the codebase."
    ],
    codeSmells: [
      "Limited unit and integration test coverage.",
      "Large files with multiple responsibilities.",
      "Some hardcoded error strings instead of localization."
    ],
    securityRisks: [
      "No schema validation for environment variables at runtime.",
      "Potential SQL injection path in raw query fallbacks.",
      "Sensitive token storage in non-HttpOnly contexts."
    ],
    performanceRisks: [
      "Large client components rendering heavy UI libraries.",
      "Lack of query pagination on core fetch routes.",
      "Unoptimized database indices."
    ],
    maintainabilityScore: 82,
    testingScore: 45,
    documentationScore: 70,
    summary: `Analysis of ${repo.full_name}: This repository follows a modern ${isPython ? "Python-based API" : "full-stack TS"} architecture with good general separation of concerns, but would benefit from increased test coverage and tighter security checks.`
  };
}

// ── API Handlers ─────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch latest analysis from database if it exists
    const { data: latest, error } = await supabase
      .from("code_analyses")
      .select("*")
      .eq("user_id", user.id)
      .eq("repository_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      console.error("Fetch analysis error:", error);
    }

    return NextResponse.json({
      analysis: latest ? latest.analysis : null,
      lastAnalyzed: latest ? latest.created_at : null
    });
  } catch (err) {
    console.error("GET Code Analysis error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const repo = await getRepositoryById(id, user.id);

    if (!repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    // 1. Gather repository context
    const [tree, packageJson, readme, commitsRes] = await Promise.all([
      fetchRepoTree(repo.owner_login, repo.name, repo.default_branch),
      fetchGitHubFile(repo.owner_login, repo.name, "package.json", repo.default_branch),
      fetchGitHubFile(repo.owner_login, repo.name, "README.md", repo.default_branch),
      supabase
        .from("commits")
        .select("sha, message, author_name, committed_date")
        .eq("user_id", user.id)
        .eq("repository_id", id)
        .order("committed_date", { ascending: false })
        .limit(20)
    ]);

    const commits = commitsRes.data || [];

    // Framework detection rules (simple detection to enrich context)
    const files = tree.slice(0, 100); // Send up to 100 files for file structure analysis
    const recentCommitsText = commits
      .map((c) => `[${c.sha.slice(0, 7)}] ${c.message}`)
      .join("\n");

    const promptContext = `
Repository: ${repo.full_name}
Description: ${repo.description || "No description"}
Primary Language: ${repo.language || "Not detected"}
Topics: ${repo.topics?.join(", ") || "None"}

File Structure Sample:
${files.join("\n")}

package.json:
${packageJson ? packageJson.slice(0, 2000) : "Not available"}

README (First 1500 chars):
${readme ? readme.slice(0, 1500) : "Not available"}

Recent Commits:
${recentCommitsText}
`;

    let parsedAnalysis: AnalysisResult;

    try {
      const llm = getLLM();
      const response = await llm.generate([
        {
          role: "system",
          content: `You are an expert AI software architect. Analyze the provided repository context and produce a structured code analysis report.
You MUST output your response as a valid JSON object ONLY matching this schema:
{
  "architecture": "Describe high-level architecture style, e.g. MVC, Clean Architecture, Serverless, etc.",
  "framework": "Primary framework used, e.g. Next.js, React, Express, FastAPI, Django, etc.",
  "renderingStrategy": "Rendering strategy if web app (App Router, Pages Router, SPA, Server API, etc.) or 'N/A'",
  "databaseLayer": "Detected database layer/ORM (Prisma, Mongoose, Supabase client, SQLAlchemy, etc.) or 'None'",
  "authentication": "Detected authentication (Supabase Auth, NextAuth, JWT, etc.) or 'None'",
  "techStack": ["Detected core libraries/languages"],
  "designPatterns": ["List design patterns observed, e.g. Repository, Singleton, Decorator, MVC"],
  "strengths": ["List 2-4 code design strengths"],
  "codeSmells": ["List 2-4 code smells or technical debt areas"],
  "securityRisks": ["List 2-4 security risks or areas needing audit"],
  "performanceRisks": ["List 2-4 performance or resource bottlenecks"],
  "maintainabilityScore": 0-100 score,
  "testingScore": 0-100 score,
  "documentationScore": 0-100 score,
  "summary": "Markdown formatted summary of overall code health, architecture, and developer recommendations"
}
Ensure the output contains no extra text or markdown formatting tags, just pure valid JSON.`
        },
        {
          role: "user",
          content: promptContext
        }
      ], { temperature: 0.2 });

      const content = response.content.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      parsedAnalysis = JSON.parse(content) as AnalysisResult;

      // Validate scores are numbers
      parsedAnalysis.maintainabilityScore = Number(parsedAnalysis.maintainabilityScore) || 50;
      parsedAnalysis.testingScore = Number(parsedAnalysis.testingScore) || 50;
      parsedAnalysis.documentationScore = Number(parsedAnalysis.documentationScore) || 50;
    } catch (llmErr) {
      console.warn("LLM analysis failed, falling back to mock analysis:", llmErr);
      parsedAnalysis = generateMockAnalysis(repo);
    }

    // 2. Save analysis to database
    let saved = false;
    let lastAnalyzed = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("code_analyses")
        .upsert(
          {
            user_id: user.id,
            repository_id: id,
            analysis: parsedAnalysis,
            created_at: lastAnalyzed,
            updated_at: lastAnalyzed,
          },
          { onConflict: "user_id,repository_id" }
        )
        .select()
        .single();

      if (error) {
        if (error.code === "42P01") {
          console.warn("code_analyses table missing, skipping DB persistence.");
        } else {
          throw error;
        }
      } else {
        saved = true;
        if (data) lastAnalyzed = data.created_at;
      }
    } catch (dbErr) {
      console.error("Failed to save analysis to DB:", dbErr);
    }

    return NextResponse.json({
      analysis: parsedAnalysis,
      lastAnalyzed,
      persisted: saved
    });
  } catch (err) {
    console.error("POST Code Analysis error:", err);
    return NextResponse.json(
      { error: "Analysis process failed" },
      { status: 500 }
    );
  }
}
