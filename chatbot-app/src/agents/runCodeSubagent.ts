import { runCode } from '../services/fileUtils';
import type { Subagent } from './types';

export const runCodeSubagent: Subagent = {
  name: 'run_code',
  description: 'Execute JavaScript code in a sandboxed environment and return the result.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to execute',
      },
      description: {
        type: 'string',
        description: 'A brief description of what this code does',
      },
    },
    required: ['code', 'description'],
  },
  execute: async (input) => {
    const code = String(input.code ?? '');
    return { output: runCode(code) };
  },
};
