// ================================================================
// Groq LLM Provider — Phase 4
// ================================================================

import type { LLMProvider, LLMRequest, LLMResponse } from "./types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqProvider implements LLMProvider {
  name = "groq" as const;
  models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ];

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        top_p: request.topP ?? 0.9,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 429) {
        throw new Error("RATE_LIMITED: Groq API rate limit exceeded. Please try again in a moment.");
      }
      throw new Error(
        `Groq API error (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      throw new Error("Groq returned an empty response");
    }

    return {
      content: choice.message.content,
      model: request.model,
      provider: "groq",
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}