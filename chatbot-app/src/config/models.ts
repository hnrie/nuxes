import type { ModelConfig } from '../types';

export const BASE_URL = 'https://diwness.cloud/v1';
export const API_KEY = 'dummy';

export const MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Best for complex agents and coding; highest intelligence across most tasks',
    contextWindow: '200K (1M beta)',
    speed: 'fast',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest model with near-frontier performance; ideal for high-volume workloads',
    contextWindow: '200K',
    speed: 'fast',
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Maximum capability with practical performance; best reasoning and coding',
    contextWindow: '200K',
    speed: 'medium',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Most intelligent model; recommended for the most demanding tasks',
    contextWindow: '200K (1M beta)',
    speed: 'slow',
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export const DEFAULT_SYSTEM_PROMPT = `You are Nexus, a highly capable AI assistant with access to tools including web search and file analysis. You can help with research, coding, writing, analysis, and complex multi-step tasks. When you need current information, use web_search. When the user attaches files, analyze them carefully. Always be concise, accurate, and helpful.`;

export const MAX_AGENT_ITERATIONS = 8;
