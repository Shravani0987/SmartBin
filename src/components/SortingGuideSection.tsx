import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Recycle, Search, ShieldCheck } from 'lucide-react';
import { MATERIAL_DIRECTORY } from '../data/presets';
import { fetchMaterialsDirectory } from '../services/wasteClassifier';
import type { MaterialReferenceEntry } from '../types/waste';

type GuideFilter = 'All' | MaterialReferenceEntry['stream'];

export const SortingGuideSection: React.FC = () => {
  const [query, setQuery] = useState('');
  const [streamFilter, setStreamFilter] = useState<GuideFilter>('All');
  const [serverEntries, setServerEntries] = useState<MaterialReferenceEntry[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const results = await fetchMaterialsDirectory(query, streamFilter);
      if (active && results !== null) {
        setServerEntries(results);
      }
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, streamFilter]);

  const localFallbackEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MATERIAL_DIRECTORY.filter((entry) => {
      const matchesFilter = streamFilter === 'All' || entry.stream === streamFilter;
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        entry.code.toLowerCase().includes(q) ||
        entry.name.toLowerCase().includes(q) ||
        entry.examples.toLowerCase().includes(q) ||
        entry.prepTip.toLowerCase().includes(q)
      );
    });
  }, [query, streamFilter]);

  const displayedEntries = serverEntries ?? localFallbackEntries;

  const handleCopyTip = async (entry: MaterialReferenceEntry) => {
    try {
      await navigator.clipboard.writeText(`${entry.code} (${entry.name}): ${entry.prepTip}`);
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === entry.id ? null : prev)), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <section
      id="sorting-guide"
      aria-label="Material sorting reference guide and resin directory"
      className="border-t border-sky-200/80 pt-10 dark:border-slate-800"
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resin &amp; Material Encyclopedia
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Search common packaging codes, contamination traps, and specialized drop-off materials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PET #1, coffee cup, battery..."
              aria-label="Search resin and material encyclopedia"
              className="min-h-[38px] w-full rounded-lg border border-sky-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-800 dark:bg-[#101B26] dark:text-slate-100"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter material encyclopedia"
            className="inline-flex flex-wrap rounded-lg bg-sky-100/70 p-1 dark:bg-slate-800/80"
          >
            {(['All', 'Recyclable', 'Contamination Trap', 'Drop-Off Only'] as const).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={streamFilter === tab}
                  onClick={() => setStreamFilter(tab)}
                  className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    streamFilter === tab
                      ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {displayedEntries.length === 0 ? (
        <div className="rounded-xl border border-sky-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-[#101B26] dark:text-slate-400">
          No materials match "{query}". Try searching for PET, aluminum, cardboard, or film.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedEntries.map((entry) => {
            const isRec = entry.stream === 'Recyclable';
            const isTrap = entry.stream === 'Contamination Trap';
            const isCopied = copiedId === entry.id;

            return (
              <article
                key={entry.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50/90 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-900 dark:border-slate-700 dark:bg-slate-950 dark:text-sky-300">
                      {entry.code}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        isRec
                          ? 'text-teal-700 dark:text-teal-400'
                          : isTrap
                          ? 'text-orange-700 dark:text-orange-400'
                          : 'text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      {isRec ? (
                        <Recycle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : isTrap ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{entry.stream}</span>
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-sm font-semibold text-slate-900 dark:text-white">
                    {entry.name}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {entry.examples}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-2 border-t border-sky-100 pt-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  <div>
                    <span className="font-semibold">Prep: </span>
                    {entry.prepTip}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyTip(entry)}
                    aria-label={`Copy prep tip for ${entry.name}`}
                    title="Copy sorting prep tip"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-sky-100 bg-sky-50/50 text-slate-500 transition-colors hover:bg-sky-100 hover:text-sky-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 cursor-pointer"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
