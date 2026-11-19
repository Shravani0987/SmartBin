import React from 'react';
import { Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-sky-200/80 bg-white py-6 dark:border-slate-800 dark:bg-[#0A121A]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-w-2xl">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600/70 dark:text-sky-400/70" aria-hidden="true" />
          <p>
            Disclaimer: SmartBin visual sorting is an informational aid. Recycling eligibility,
            plastic resin acceptance, and coated-paper handling depend on your local municipal
            sorting rules and material recovery facility (MRF).
          </p>
        </div>

        <p className="font-mono text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
          SmartBin · Material Circularity
        </p>
      </div>
    </footer>
  );
};
