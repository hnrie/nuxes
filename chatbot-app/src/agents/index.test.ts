import { describe, expect, it } from 'vitest';
import { executeSubagentCall } from './index';

describe('executeSubagentCall', () => {
  it('returns invalid_arguments on malformed json arguments', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: { name: 'web_search', arguments: '{bad json' },
      },
      { attachedFiles: [] },
    );

    expect(response.ok).toBe(false);
if (response.ok) throw new Error('expected failure');
    expect(response.errorCode).toBe('invalid_arguments');
  });

  it('returns unknown_tool on missing tool', async () => {
    const response = await executeSubagentCall(
      {
        id: '1',
        type: 'function',
        function: { name: 'not_a_tool', arguments: '{}' },
      },
      { attachedFiles: [] },
    );

    expect(response.ok).toBe(false);
if (response.ok) throw new Error('expected failure');
    expect(response.errorCode).toBe('unknown_tool');
  });
});
