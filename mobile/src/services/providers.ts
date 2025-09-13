// Local copy of keys we need from server constants.
const OPENAI_KEYS: string[] = [
  'model',
  'prompt',
  'stream',
  'temperature',
  'top_p',
  'frequency_penalty',
  'presence_penalty',
  'stop',
  'seed',
  'logit_bias',
  'logprobs',
  'max_tokens',
  'n',
  'best_of',
];

export type ParamType = 'text' | 'number' | 'boolean';

export interface ProviderParamDescriptor {
  key: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
}

export interface ProviderDescriptor {
  id: 'openai' | 'gemini' | 'claude' | 'openrouter';
  title: string;
  params: ProviderParamDescriptor[];
}

export const PROVIDERS: ProviderDescriptor[] = [
  {
    id: 'openai',
    title: 'OpenAI-Compatible',
    params: (
      OPENAI_KEYS as string[]
    ).map((k) => {
      const numKeys = new Set(['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'max_tokens', 'n', 'best_of', 'seed']);
      const boolKeys = new Set(['stream']);
      const type: ParamType = numKeys.has(k) ? 'number' : boolKeys.has(k) ? 'boolean' : 'text';
      return { key: k, type } as ProviderParamDescriptor;
    }),
  },
  {
    id: 'claude',
    title: 'Anthropic Claude',
    params: [
      { key: 'model', type: 'text' },
      { key: 'stream', type: 'boolean' },
      { key: 'temperature', type: 'number', min: 0, max: 2, step: 0.1 },
      { key: 'max_tokens', type: 'number', min: 1, max: 8192, step: 1 },
    ],
  },
  {
    id: 'gemini',
    title: 'Google Gemini',
    params: [
      { key: 'model', type: 'text' },
      { key: 'temperature', type: 'number', min: 0, max: 2, step: 0.1 },
      { key: 'top_p', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'max_output_tokens', type: 'number', min: 1, max: 8192, step: 1 },
      { key: 'stream', type: 'boolean' },
    ],
  },
  {
    id: 'openrouter',
    title: 'OpenRouter',
    params: [
      { key: 'model', type: 'text' },
      { key: 'temperature', type: 'number', min: 0, max: 2, step: 0.1 },
      { key: 'top_p', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'repetition_penalty', type: 'number', min: 0, max: 2, step: 0.1 },
      { key: 'max_tokens', type: 'number', min: 1, max: 8192, step: 1 },
      { key: 'stream', type: 'boolean' },
    ],
  },
];

export function getProvider(id: ProviderDescriptor['id']): ProviderDescriptor | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
