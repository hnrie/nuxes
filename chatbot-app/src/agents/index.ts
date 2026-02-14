import type { ToolCall } from '../types';
import { analyzeFileSubagent } from './analyzeFileSubagent';
import { runCodeSubagent } from './runCodeSubagent';
import type {
  ExecutionFailure,
  ExecutionMetadata,
  Subagent,
  SubagentContext,
  SubagentResponse,
  ValidatedArguments,
} from './types';
import { webSearchSubagent } from './webSearchSubagent';

export const subagentRegistry: Subagent[] = [
  webSearchSubagent,
  analyzeFileSubagent,
  runCodeSubagent,
];

export function getAgentTools() {
  return subagentRegistry.map((subagent) => ({
    type: 'function' as const,
    function: {
      name: subagent.name,
      description: subagent.description,
      parameters: subagent.inputSchema,
    },
  }));
}

function parseToolArguments(rawArguments: string): ValidatedArguments {
  try {
    const parsed = JSON.parse(rawArguments) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        message: 'Arguments must be a JSON object.',
        details: { receivedType: Array.isArray(parsed) ? 'array' : typeof parsed },
      };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      message: 'Arguments must be valid JSON.',
      details: { rawArguments },
    };
  }
}

function validateAgainstSchema(subagent: Subagent, args: Record<string, unknown>): ValidatedArguments {
  const missing = subagent.inputSchema.required.filter((field) => {
    const value = args[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing or invalid required fields: ${missing.join(', ')}`,
      details: {
        required: subagent.inputSchema.required,
        received: args,
      },
    };
  }

  for (const [key, value] of Object.entries(args)) {
    const property = subagent.inputSchema.properties[key];
    if (!property) {
      return {
        ok: false,
        message: `Unexpected argument: ${key}`,
        details: {
          allowed: Object.keys(subagent.inputSchema.properties),
          received: args,
        },
      };
    }
    if (property.type === 'string' && typeof value !== 'string') {
      return {
        ok: false,
        message: `Argument ${key} must be a string`,
        details: { key, receivedType: typeof value },
      };
    }
  }

  return { ok: true, value: args };
}

function buildMetadata(startTime: Date, status: 'success' | 'failed', retries: number, failures: ExecutionFailure[]): ExecutionMetadata {
  return {
    startTime: startTime.toISOString(),
    endTime: new Date().toISOString(),
    status,
    retries,
    failures,
  };
}

function formatResponse(response: SubagentResponse): string {
  return JSON.stringify(response, null, 2);
}

export async function executeSubagentCall(call: ToolCall, context: SubagentContext): Promise<SubagentResponse> {
  const startTime = new Date();
  const subagent = subagentRegistry.find((item) => item.name === call.function.name);

  if (!subagent) {
    return {
      ok: false,
      toolName: call.function.name,
      errorCode: 'unknown_tool',
      message: `Unknown tool: ${call.function.name}`,
      metadata: buildMetadata(startTime, 'failed', 0, []),
    };
  }

  const parsed = parseToolArguments(call.function.arguments);
  if (!parsed.ok) {
    return {
      ok: false,
      toolName: subagent.name,
      errorCode: 'invalid_arguments',
      message: parsed.message,
      details: parsed.details,
      metadata: buildMetadata(startTime, 'failed', 0, []),
    };
  }

  const validated = validateAgainstSchema(subagent, parsed.value);
  if (!validated.ok) {
    return {
      ok: false,
      toolName: subagent.name,
      errorCode: 'invalid_arguments',
      message: validated.message,
      details: validated.details,
      metadata: buildMetadata(startTime, 'failed', 0, []),
    };
  }

  const failures: ExecutionFailure[] = [];
  const maxRetries = subagent.maxRetries ?? 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await subagent.execute(validated.value, context);
      return {
        ok: true,
        toolName: subagent.name,
        output: result.output,
        metadata: buildMetadata(startTime, 'success', attempt, failures),
      };
    } catch (error) {
      failures.push({
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      });
    }
  }

  return {
    ok: false,
    toolName: subagent.name,
    errorCode: 'execution_failed',
    message: 'Subagent execution failed after retries.',
    metadata: buildMetadata(startTime, 'failed', maxRetries, failures),
    details: { arguments: validated.value },
  };
}

export function formatSubagentResponse(response: SubagentResponse): string {
  return formatResponse(response);
}
