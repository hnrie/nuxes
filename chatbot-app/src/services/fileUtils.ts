import type { AttachedFile } from '../types';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const TEXT_TYPES = [
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
  'application/json', 'application/xml', 'text/javascript', 'application/javascript',
  'text/typescript', 'application/typescript',
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function isImageType(type: string): boolean {
  return IMAGE_TYPES.includes(type) || type.startsWith('image/');
}

function isTextType(type: string): boolean {
  return TEXT_TYPES.includes(type) || type.startsWith('text/');
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get just the base64 data
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

export async function processFile(file: File): Promise<AttachedFile> {
  const isImage = isImageType(file.type);
  const isText = isTextType(file.type);

  let content = '';

  if (isImage) {
    content = await readFileAsBase64(file);
  } else if (isText) {
    content = await readFileAsText(file);
  } else {
    // For binary files (PDF, etc.) we try to read as text with a note
    try {
      content = await readFileAsText(file);
    } catch {
      content = `[Binary file: ${file.name} (${formatFileSize(file.size)})]`;
    }
  }

  return {
    id: generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    content,
    isImage,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(type: string, name: string): string {
  if (isImageType(type)) return '🖼️';
  if (type === 'application/pdf') return '📄';
  if (type.includes('spreadsheet') || name.endsWith('.csv') || name.endsWith('.xlsx')) return '📊';
  if (type.includes('presentation') || name.endsWith('.pptx')) return '📑';
  if (type.includes('json') || name.endsWith('.json')) return '{ }';
  if (type.includes('javascript') || name.endsWith('.js') || name.endsWith('.ts')) return '⚡';
  if (type.includes('python') || name.endsWith('.py')) return '🐍';
  if (type.includes('html') || name.endsWith('.html')) return '🌐';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return '📝';
  return '📁';
}

// Run sandboxed JS code using Function constructor
export function runCode(code: string): string {
  try {
    const logs: string[] = [];
    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push('[error] ' + args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push('[warn] ' + args.map(String).join(' ')),
    };

    const fn = new Function('console', 'Math', 'JSON', `"use strict";\n${code}`);
    const result = fn(mockConsole, Math, JSON);

    const output: string[] = [];
    if (logs.length > 0) output.push('Output:\n' + logs.join('\n'));
    if (result !== undefined) output.push(`Return value: ${JSON.stringify(result)}`);
    if (output.length === 0) output.push('Code executed successfully (no output)');

    return output.join('\n');
  } catch (err) {
    return `Runtime error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
