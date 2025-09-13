import { ProviderId } from '../stores/connections';

// Mirrors values from server src/endpoints/* and src/constants.js where applicable.
// Keep this as a single source for mobile UI.

export type ProviderMeta = {
  baseUrl?: string; // default API base
  apiKeyLabel: string;
  modelLabel: string; // e.g. "Google 模型"
  models: string[]; // curated, not exhaustive; can be extended later or fetched dynamically
};

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    apiKeyLabel: 'OpenAI API Key',
    modelLabel: '模型',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  },
  claude: {
    baseUrl: 'https://api.anthropic.com',
    apiKeyLabel: 'Anthropic API Key',
    modelLabel: '模型',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com', // see src/endpoints/google.js API_MAKERSUITE
    apiKeyLabel: 'Google AI Studio API 密钥',
    modelLabel: 'Google 模型',
    models: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api', // see src/endpoints/openrouter.js
    apiKeyLabel: 'OpenRouter API Key',
    modelLabel: '模型',
    models: [
      'openrouter/auto',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-exp',
      'openai/gpt-4o-mini',
    ],
  },
};

export function getProviderMeta(id: ProviderId): ProviderMeta {
  return PROVIDER_META[id];
}
