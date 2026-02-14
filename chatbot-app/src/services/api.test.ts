import { describe, it, expect, vi, afterEach } from 'vitest';
import { chatCompletionStream } from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chatCompletionStream', () => {
  it('emits ready tool call as soon as arguments are complete', async () => {
    const chunks = [
      'data: {"id":"1","object":"chat.completion.chunk","model":"x","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"web_search","arguments":"{\\"query\\":\\"weather\\"}"}}]},"finish_reason":null}]}\n\n',
      'data: {"id":"2","object":"chat.completion.chunk","model":"x","choices":[{"index":0,"delta":{"content":"Let me search that now."},"finish_reason":null}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const events: string[] = [];

    await chatCompletionStream(
      {
        model: 'test-model',
        messages: [{ role: 'user', content: 'search weather' }],
        stream: true,
        useTools: true,
      },
      () => {
        events.push('chunk');
      },
      () => {
        events.push('tool_calls');
      },
      () => {
        events.push('tool_ready');
      },
    );

    expect(events[0]).toBe('tool_ready');
    expect(events.includes('chunk')).toBe(false);
  });
});
