import type { WebSearchResults, SearchResult } from '../types';

// ─── Wikipedia Search ────────────────────────────────────────────────────────

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

interface WikiSearchResponse {
  query: {
    search: WikiSearchResult[];
  };
}

async function searchWikipedia(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    format: 'json',
    origin: '*',
    srlimit: '5',
    srprop: 'snippet|titlesnippet',
  });

  const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data: WikiSearchResponse = await res.json();
  return (data.query?.search ?? []).map((r) => ({
    title: r.title,
    snippet: r.snippet.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    source: 'wikipedia' as const,
  }));
}

// ─── DuckDuckGo Instant Answer ───────────────────────────────────────────────

interface DDGTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: DDGTopic[];
}

interface DDGResponse {
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  RelatedTopics?: DDGTopic[];
  Answer?: string;
  AnswerType?: string;
  Definition?: string;
  DefinitionURL?: string;
}

async function searchDDG(query: string): Promise<{
  abstract: string;
  abstractUrl: string;
  extraResults: SearchResult[];
}> {
  try {
    // Try via Vite dev-server proxy first, then fall back to CORS proxy
    let data: DDGResponse | null = null;

    const ddgPath = `/api/ddg/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    try {
      const res = await fetch(ddgPath, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        data = (await res.json()) as DDGResponse;
      }
    } catch {
      // Dev proxy not available – try allorigins CORS proxy
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      )}`;
      const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
      if (proxyRes.ok) {
        const wrapper = await proxyRes.json() as { contents: string };
        data = JSON.parse(wrapper.contents) as DDGResponse;
      }
    }

    if (!data) return { abstract: '', abstractUrl: '', extraResults: [] };

    const extraResults: SearchResult[] = [];
    const topics = data.RelatedTopics ?? [];
    for (const topic of topics.slice(0, 4)) {
      if (topic.Text && topic.FirstURL) {
        extraResults.push({
          title: topic.Text.substring(0, 80),
          snippet: topic.Text,
          url: topic.FirstURL,
          source: 'ddg' as const,
        });
      }
    }

    return {
      abstract: data.AbstractText ?? data.Answer ?? data.Definition ?? '',
      abstractUrl: data.AbstractURL ?? data.DefinitionURL ?? '',
      extraResults,
    };
  } catch {
    return { abstract: '', abstractUrl: '', extraResults: [] };
  }
}

// ─── Combined Search ─────────────────────────────────────────────────────────

export async function webSearch(query: string): Promise<WebSearchResults> {
  const [wikiResults, ddgData] = await Promise.allSettled([
    searchWikipedia(query),
    searchDDG(query),
  ]);

  const results: SearchResult[] = [];

  if (wikiResults.status === 'fulfilled') {
    results.push(...wikiResults.value);
  }

  let abstract = '';
  let abstractUrl = '';

  if (ddgData.status === 'fulfilled') {
    abstract = ddgData.value.abstract;
    abstractUrl = ddgData.value.abstractUrl;
    // Add DDG results that aren't already covered by Wikipedia
    for (const r of ddgData.value.extraResults) {
      if (!results.some((w) => w.url === r.url)) {
        results.push(r);
      }
    }
  }

  return {
    query,
    results: results.slice(0, 8),
    abstract: abstract || undefined,
    abstractUrl: abstractUrl || undefined,
  };
}

// ─── Format search results for AI context ───────────────────────────────────

export function formatSearchResultsForAI(results: WebSearchResults): string {
  const parts: string[] = [];

  parts.push(`Web search results for: "${results.query}"\n`);

  if (results.abstract) {
    parts.push(`Summary: ${results.abstract}`);
    if (results.abstractUrl) parts.push(`Source: ${results.abstractUrl}`);
    parts.push('');
  }

  results.results.slice(0, 6).forEach((r, i) => {
    parts.push(`[${i + 1}] ${r.title}`);
    parts.push(`URL: ${r.url}`);
    parts.push(`Snippet: ${r.snippet}`);
    parts.push('');
  });

  return parts.join('\n');
}
