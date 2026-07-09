// ================================================================
// LLM Types — Phase 4 foundation, reused by Phase 6 & 8
// ================================================================

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  models: string[];
  generate(request: LLMRequest): Promise<LLMResponse>;
}

export type ProviderName = "groq";