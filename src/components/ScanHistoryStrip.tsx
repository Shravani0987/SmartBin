import React from 'react';
import { Ban, Recycle, Trash2, X } from 'lucide-react';
import type { ScanHistoryItem } from '../types/waste';

interface ScanHistoryStripProps {
  items: ScanHistoryItem[];
  activeItemId: string | null;
  onSelect: (item: ScanHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearHistory: () => void;
}

export const ScanHistoryStrip: React.FC<ScanHistoryStripProps> = ({
  items,
  activeItemId,
  onSelect,
  onDeleteItem,
  onClearHistory,
}) => {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Recent scan history"
      className="rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]"
    >
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Session Scan Log
          </h3>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-sky-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Clear Log</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 8).map((item) => {
          const isRecyclable = item.result.primaryCategory === 'Recyclable';
          const isActive = item.id === activeItemId;

          return (
            <div
              key={item.id}
              className={`group relative flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                isActive
                  ? 'border-sky-600 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/25'
                  : 'border-sky-100 bg-sky-50/35 hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-md cursor-pointer"
              >
                <img
                  src={item.imageSrc}
                  alt={item.result.itemDetected}
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 shrink-0 rounded-md object-cover bg-sky-100 dark:bg-slate-800"
                />
                <div className="min-w-0 flex-1 pr-5">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {item.result.itemDetected}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
                    {isRecyclable ? (
                      <Recycle className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    ) : (
                      <Ban className="h-3 w-3 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                    )}
                    <span
                      className={
                        isRecyclable
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-orange-700 dark:text-orange-400'
                      }
                    >
                      {item.result.primaryCategory}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {item.result.confidenceScore}%
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onDeleteItem(item.id)}
                aria-label={`Remove ${item.result.itemDetected} from scan log`}
                title="Remove scan"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-75 transition-colors hover:bg-white hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-rose-400 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
