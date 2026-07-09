// ================================================================
// LLM Service — Orchestrator with provider registry
// ================================================================

import type { LLMMessage, LLMRequest, LLMResponse, ProviderName } from "./types";
import { GroqProvider } from "./groq";

class LLMService {
  private providers = new Map<string, GroqProvider>();
  private defaultProvider: ProviderName = "groq";
  private defaultModel = "llama-3.3-70b-versatile";

  constructor() {
    this.registerProvider(new GroqProvider());
  }

  registerProvider(provider: { name: string }): void {
    this.providers.set(provider.name, provider as GroqProvider);
  }

  async generate(
    messages: LLMMessage[],
    options?: {
      model?: string;
      provider?: ProviderName;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    }
  ): Promise<LLMResponse> {
    const providerName = options?.provider ?? this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`LLM provider "${providerName}" is not registered`);
    }

    const request: LLMRequest = {
      model: options?.model ?? this.defaultModel,
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      topP: options?.topP,
    };

    return provider.generate(request);
  }
}

// Singleton
export const llmService = new LLMService();