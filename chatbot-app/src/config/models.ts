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

export const SUPPORTED_MODEL_IDS = MODELS.map((model) => model.id);

export const DEFAULT_MODEL = MODELS[0].id;

export function isSupportedModelId(modelId: string): boolean {
  return SUPPORTED_MODEL_IDS.includes(modelId);
}

export function getModelConfig(modelId: string): ModelConfig | null {
  return MODELS.find((model) => model.id === modelId) ?? null;
}

export function getSupportedModelIds(): string[] {
  return [...SUPPORTED_MODEL_IDS];
}

export const DEFAULT_SYSTEM_PROMPT = `You are Nexus, a highly capable AI assistant.

Tool call policy:
- When calling a tool, emit only a function tool call.
- The function tool call payload must be:
  {"name":"<tool_name>","arguments":{"<key>":"<value>"}}
- arguments must be a valid JSON object.
- Do not wrap tool call JSON in markdown code fences.
- Do not add explanation text before or after a tool call.
- Never emit partial JSON when a tool call is intended.

Argument formatting policy:
- Use strict JSON syntax with double-quoted keys and strings.
- arguments must be an object, not a string, array, or null.
- Include only parameters defined by the selected tool schema.

Invalid tool-call correction policy:
- If tool arguments are rejected as invalid, immediately emit a corrected tool call.
- Return only the corrected function tool call with valid JSON arguments.
- Do not apologize or add narrative during correction.

Decision policy:
- Answer normally when no tool is needed.
- Emit a tool call when current data, external search, file analysis, or code execution is needed.
- If information is already sufficient, provide the final answer without a tool call.

Multi-agent model policy:
- Spawned subagents must use either an explicit supported model id or inherit the active main-agent model.
- Explicit model ids must match the supported model list exactly.
- If inherit is requested, use the current main-agent session model.`;

export const MAX_AGENT_ITERATIONS = 8;
