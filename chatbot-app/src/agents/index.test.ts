import { describe, expect, it } from 'vitest';
import { executeSubagentCall, resolveSubagentModel } from './index';

describe('executeSubagentCall', () => {
  it('returns invalid_arguments on malformed json arguments', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: { name: 'web_search', arguments: '{bad json' },
      },
      { attachedFiles: [], mainAgentModel: 'claude-sonnet-4-5-20250929' },
    );

    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected failure');
    expect(response.errorCode).toBe('invalid_arguments');
  });

  it('returns invalid_arguments when arguments are not a json object', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: { name: 'web_search', arguments: '"query"' },
      },
      { attachedFiles: [], mainAgentModel: 'claude-sonnet-4-5-20250929' },
    );

    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected failure');
    expect(response.errorCode).toBe('invalid_arguments');
    expect(response.message).toMatch(/json object/i);
  });

  it('returns unknown_tool on missing tool', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: { name: 'not_a_tool', arguments: '{}' },
      },
      { attachedFiles: [], mainAgentModel: 'claude-sonnet-4-5-20250929' },
    );

    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected failure');
    expect(response.errorCode).toBe('unknown_tool');
  });

  it('accepts explicit supported subagent model', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: {
          name: 'web_search',
          arguments: JSON.stringify({ query: 'weather today', model: 'claude-haiku-4-5-20251001' }),
        },
      },
      { attachedFiles: [], mainAgentModel: 'claude-sonnet-4-5-20250929' },
    );

    expect(response.ok).toBe(true);
  });

  it('falls back to inherit model when requested', () => {
    const resolution = resolveSubagentModel('claude-opus-4-6', 'inherit');
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('expected success');
    expect(resolution.value.resolvedModelId).toBe('claude-opus-4-6');
    expect(resolution.value.resolution).toBe('inherit');
  });

  it('rejects unsupported explicit model with clear payload', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: {
          name: 'web_search',
          arguments: JSON.stringify({ query: 'weather today', model: 'not-real-model' }),
        },
      },
      { attachedFiles: [], mainAgentModel: 'claude-sonnet-4-5-20250929' },
    );

    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected failure');
    expect(response.errorCode).toBe('unsupported_model');
    expect(response.details).toMatchObject({ requestedModel: 'not-real-model' });
  });
});
