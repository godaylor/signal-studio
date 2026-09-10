import type { AnalysisQueryV1, AnalysisResult } from './contracts';

interface CacheEntry {
  expiresAt: number;
  value: AnalysisResult;
}

export class InMemoryAnalysisCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string, now = Date.now()): AnalysisResult | undefined {
    const entry = this.entries.get(key);

    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: AnalysisResult, ttlSeconds: number, now = Date.now()) {
    if (ttlSeconds <= 0) return;

    this.entries.delete(key);
    this.entries.set(key, { expiresAt: now + ttlSeconds * 1000, value });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear() {
    this.entries.clear();
  }
}

export function getAnalysisCacheTtlSeconds(query: AnalysisQueryV1, now = Date.now()) {
  const end = new Date(query.range.endAt).getTime();
  const age = now - end;

  if (age < 0) return 0;
  if (age < 5 * 60 * 1000) return 30;
  if (age < 24 * 60 * 60 * 1000) return 60;
  return 120;
}
