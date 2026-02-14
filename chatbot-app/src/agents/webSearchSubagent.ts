import { webSearch, formatSearchResultsForAI } from '../services/webSearch';
import type { Subagent } from './types';

export const webSearchSubagent: Subagent = {
  name: 'web_search',
  description:
    'Search the web for current information, news, facts, or any topic. Use this when you need up-to-date information that may not be in your training data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up. Be specific and concise.',
      },
    },
    required: ['query'],
  },
  execute: async (input) => {
    const query = String(input.query ?? '');
    const results = await webSearch(query);
    return { output: formatSearchResultsForAI(results) };
  },
};
