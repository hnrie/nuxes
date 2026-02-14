import type { Subagent } from './types';

export const analyzeFileSubagent: Subagent = {
  name: 'analyze_file',
  description: 'Analyze a file that the user has attached. Returns the file content or analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'The name of the file to analyze',
      },
      instruction: {
        type: 'string',
        description: 'What specific analysis to perform on the file',
      },
    },
    required: ['filename', 'instruction'],
  },
  execute: async (input, context) => {
    const filename = String(input.filename ?? '');
    const instruction = String(input.instruction ?? '');

    const file = context.attachedFiles.find((item) => item.name === filename || item.name.includes(filename));
    if (!file) {
      return {
        output: `File "${filename}" not found in attached files. Available: ${
          context.attachedFiles.map((item) => item.name).join(', ') || 'none'
        }`,
      };
    }

    if (file.isImage) {
      return {
        output: `File "${file.name}" is an image (${file.type}). ${instruction}. The image has been provided to you in the conversation context.`,
      };
    }

    const preview =
      file.content.length > 3000 ? file.content.substring(0, 3000) + '\n... [truncated]' : file.content;

    return {
      output: `File: ${file.name} (${file.type})\nInstruction: ${instruction}\n\nContent:\n${preview}`,
    };
  },
};
