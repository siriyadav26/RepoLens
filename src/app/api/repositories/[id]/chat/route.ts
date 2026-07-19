import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retrieveContext } from "@/lib/rag/retrieve";
import { 
  isQuestionRelatedToRepository, 
  buildRagPrompt, 
  UNRELATED_REPLY, 
  NOT_FOUND_REPLY 
} from "@/lib/rag/prompt";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// RAG-only Groq key — set GROQ_RAG_API_KEY in .env.local
const GROQ_RAG_API_KEY = process.env.GROQ_RAG_API_KEY ?? process.env.GROQ_API_KEY ?? "";
const RAG_MODEL = "llama-3.3-70b-versatile";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;
    const body = await request.json();
    const message = body.message || body.question;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message or question is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Verify Auth & Repository Ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: repo, error: repoError } = await supabase
      .from("repositories")
      .select("id, user_id")
      .eq("id", repoId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    if (repo.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Initial Guardrail: Is the question related?
    if (!isQuestionRelatedToRepository(message)) {
      return NextResponse.json({
        answer: UNRELATED_REPLY,
        citations: []
      });
    }

    // 3. Retrieve Context
    const chunks = await retrieveContext(message, repoId, 5);

    // If no context was retrieved (e.g. repo hasn't been indexed or no matches)
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        answer: NOT_FOUND_REPLY,
        citations: []
      });
    }

    // 4. Build Prompt
    const prompt = buildRagPrompt(message, chunks);

    // 5. Call Groq
    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_RAG_API_KEY}`,
      },
      body: JSON.stringify({
        model: RAG_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Strict, deterministic answering
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq RAG Error:", errText);
      throw new Error(`Failed to generate answer from Groq: ${groqRes.status}`);
    }

    const groqData = await groqRes.json();
    const answer = groqData.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("Empty response from Groq");
    }

    // Format citations supporting both keys for compatibility
    const citations = chunks.map(c => ({
      source: c.file_path,
      file_path: c.file_path,
      score: Number(c.similarity.toFixed(2)),
      similarity: Number(c.similarity.toFixed(2))
    }));

    return NextResponse.json({
      answer,
      citations
    });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat" },
      { status: 500 }
    );
  }
}
