import type { ResolvedSubagentModelMetadata, SubagentModelSelection, AttachedFile } from '../types';

export type SchemaProperty = {
  type: 'string';
  description: string;
};

export type InputSchema = {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
};

export type SubagentContext = {
  attachedFiles: AttachedFile[];
  mainAgentModel: string;
  requestedSubagentModel?: SubagentModelSelection;
  resolvedSubagentModel?: ResolvedSubagentModelMetadata;
};

export type SubagentExecuteResult = {
  output: string;
  retries?: number;
};

export type ExecutionFailure = {
  attempt: number;
  error: string;
  at: string;
};

export type ExecutionMetadata = {
  startTime: string;
  endTime: string;
  status: 'success' | 'failed';
  retries: number;
  failures: ExecutionFailure[];
};

export type SubagentSuccess = {
  ok: true;
  toolName: string;
  output: string;
  metadata: ExecutionMetadata;
};

export type SubagentError = {
  ok: false;
  toolName: string;
  errorCode: 'unknown_tool' | 'invalid_arguments' | 'execution_failed' | 'unsupported_model';
  message: string;
  metadata: ExecutionMetadata;
  details?: unknown;
};

export type SubagentResponse = SubagentSuccess | SubagentError;

export interface Subagent {
  name: string;
  description: string;
  inputSchema: InputSchema;
  maxRetries?: number;
  execute: (input: Record<string, unknown>, context: SubagentContext) => Promise<SubagentExecuteResult>;
}

export type ValidatedArguments =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string; details: unknown };
