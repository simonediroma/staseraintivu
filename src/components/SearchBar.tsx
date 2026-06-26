'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface SearchResult {
  channelId: string;
  channelName: string;
  startAt: string;
  stopAt: string;
  title: string;
  description: string | null;
  categories: string[];
}

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!searchParams.get('q'));
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setSearched(false);
      router.replace('/cerca', { scroll: false });
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      router.replace(`/cerca?q=${encodeURIComponent(trimmed)}`, { scroll: false });

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=20`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        setResults(data.results);
        setTotal(data.total);
        setSearched(true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca programmi TV…"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
        aria-label="Cerca programmi"
      />

      {loading && (
        <p className="mt-4 text-center text-gray-500 dark:text-gray-400">Ricerca in corso…</p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="mt-6 text-center text-gray-500 dark:text-gray-400">
          Nessun risultato per &quot;{query.trim()}&quot;
        </p>
      )}

      {!loading && !searched && (
        <p className="mt-6 text-center text-gray-400 dark:text-gray-500">
          Inizia a digitare per cercare programmi
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-4 space-y-3">
          {total > results.length && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mostrati {results.length} di {total} risultati
            </p>
          )}
          {results.map((r) => {
            const start = new Date(r.startAt);
            const dateStr = start.toLocaleDateString('it-IT', {
              weekday: 'short', day: 'numeric', month: 'short',
            });
            const timeStr = start.toLocaleTimeString('it-IT', {
              hour: '2-digit', minute: '2-digit',
            });

            return (
              <div
                key={`${r.channelId}-${r.startAt}`}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    {r.channelName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {dateStr} · {timeStr}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</p>
                {r.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {r.description}
                  </p>
                )}
                {r.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.categories.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
