import { describe, expect, it } from 'vitest';
import { detectToolIntentOnly, parseFallbackToolCalls, shouldAttemptArgumentRepair } from './useChat';

describe('tool intent detection', () => {
  it('detects plain text tool intent', () => {
    expect(detectToolIntentOnly('Let me search for that now.')).toBe(true);
    expect(detectToolIntentOnly('Here is the final answer.')).toBe(false);
  });

  it('normalizes unambiguous intent to web_search fallback call', () => {
    const parsed = parseFallbackToolCalls("I'll look up best pizza in naples.");
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0].function.name).toBe('web_search');
    expect(parsed.needsClarification).toBe(false);
  });

  it('asks for clarification when fallback intent is ambiguous', () => {
    const parsed = parseFallbackToolCalls('Let me search that for you.');
    expect(parsed.toolCalls).toHaveLength(0);
    expect(parsed.needsClarification).toBe(true);
    expect(parsed.clarificationPrompt).toMatch(/specific query/i);
  });

  it('allows bounded argument repair retries', () => {
    const messages = [
      {
        role: 'tool' as const,
        tool_call_id: '1',
        name: 'web_search',
        content: JSON.stringify({ errorCode: 'invalid_arguments' }),
      },
    ];
    expect(shouldAttemptArgumentRepair(messages, 0, 2)).toBe(true);
    expect(shouldAttemptArgumentRepair(messages, 2, 2)).toBe(false);
  });
});
