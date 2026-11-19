import React from 'react';

interface HeaderProps {
  onQuickUploadClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onQuickUploadClick }) => {
  return (
    <header className="border-b border-sky-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-[#0A121A]/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Brand wordmark */}
        <a
          href="#analyzer"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-md"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-sky-600 dark:text-sky-400 shrink-0"
          >
            <rect
              x="2.5"
              y="2.5"
              width="19"
              height="19"
              rx="5"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 7.5C14.4853 7.5 16.5 9.51472 16.5 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-display">SmartBin</span>
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <a
            href="#analyzer"
            className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Analyzer
          </a>
          <a
            href="#presets"
            className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sample Presets
          </a>
          <a
            href="#analytics"
            className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Analytics
          </a>
          <a
            href="#sorting-guide"
            className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sorting Guide
          </a>
        </nav>

        {/* Zone 3: Single primary CTA button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onQuickUploadClick}
            className="min-h-[40px] rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 dark:focus-visible:ring-offset-[#0A121A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Upload Waste
          </button>
        </div>
      </div>
    </header>
  );
};
