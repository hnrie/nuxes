// ─── Message Types ────────────────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export type MessageContent = TextContent | ImageContent;

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: MessageRole;
  content: string | MessageContent[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// ─── UI Message (what we display in the chat) ─────────────────────────────────

export type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;      // base64 for images, text for text files
  isImage: boolean;
};

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: AttachedFile[];
  agentSteps?: AgentStep[];
  isStreaming?: boolean;
  timestamp: Date;
  error?: string;
}

// ─── Agent / Tool Types ───────────────────────────────────────────────────────

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface AgentStep {
  id: string;
  toolName: string;
  toolCallId: string;
  input: string;
  output?: string;
  status: AgentStepStatus;
  startedAt: Date;
  completedAt?: Date;
  retries?: number;
  failures?: Array<{ attempt: number; error: string; at: string }>;
}

// ─── Web Search Types ─────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: 'wikipedia' | 'ddg';
}

export interface WebSearchResults {
  query: string;
  results: SearchResult[];
  abstract?: string;
  abstractUrl?: string;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunkDelta {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

// ─── Model Config ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  contextWindow: string;
  speed: 'fast' | 'medium' | 'slow';
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppView = 'chat' | 'settings';

export interface AppSettings {
  selectedModel: string;
  systemPrompt: string;
  temperature: number;
  webSearchEnabled: boolean;
  streamingEnabled: boolean;
}
