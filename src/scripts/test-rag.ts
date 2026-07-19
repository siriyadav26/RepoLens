import { embedRepository } from "../lib/rag/embed-repository";
import { retrieveContext } from "../lib/rag/retrieve";
import { isQuestionRelatedToRepository, buildRagPrompt } from "../lib/rag/prompt";
import { createClient } from "@supabase/supabase-js";

// A small test script to verify the RAG logic
async function testRag() {
  const repoOwner = "siriyadav26";
  const repoName = "old-age";
  const defaultBranch = "main";
  
  // We need the repoId from DB
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Looking up repository siriyadav26/old-age...");
  const { data: repo, error: repoErr } = await supabase
    .from("repositories")
    .select("id")
    .eq("full_name", `${repoOwner}/${repoName}`)
    .single();

  if (repoErr || !repo) {
    console.error("Repository not found in DB. Make sure it's imported first.");
    return;
  }

  const repoId = repo.id;
  console.log(`Found repo ID: ${repoId}`);

  console.log("1. Testing embedRepository...");
  try {
    const res = await embedRepository(repoId);
    console.log("Embed result:", res);
  } catch (err) {
    console.error("Embed error:", err);
  }

  console.log("\n2. Testing Guardrails...");
  const tests = [
    "How to make paneer biryani?",
    "Who is the PM of India?",
    "Write a poem.",
    "Explain the folder structure.",
    "How does authentication work?",
    "Which database is used?",
    "Where is repository import implemented?"
  ];

  for (const q of tests) {
    const related = isQuestionRelatedToRepository(q);
    console.log(`- "${q}" => ${related ? "ALLOWED" : "REJECTED"}`);
  }

  console.log("\n3. Testing Retrieval...");
  try {
    const chunks = await retrieveContext("How does authentication work?", repoId, 2);
    console.log("Retrieved chunks:", chunks.map(c => ({ path: c.file_path, score: c.similarity })));
  } catch (err) {
    console.error("Retrieve error:", err);
  }
}

testRag().catch(console.error);
