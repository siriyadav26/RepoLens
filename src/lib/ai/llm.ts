import { llmService } from "@/lib/llm";

export interface LLMChatModel {
  generate: (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ) => Promise<{ content: string }>;
}

export function getLLM(): LLMChatModel {
  return {
    generate: async (messages, options) => {
      const response = await llmService.generate(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
      return {
        content: response.content,
      };
    },
  };
}
