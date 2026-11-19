import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Droplets,
  HelpCircle,
  Layers,
  Leaf,
  Lightbulb,
  Recycle,
  RefreshCw,
  ShieldAlert,
  Wrench,
  Zap,
} from 'lucide-react';
import type {
  SamplePreset,
  SortingProfileId,
  WasteClassificationResult,
} from '../types/waste';
import { SAMPLE_PRESETS, SORTING_PROFILES } from '../data/presets';

interface ResultDashboardProps {
  result: WasteClassificationResult | null;
  isLoading: boolean;
  error: string | null;
  hasImage: boolean;
  activeSortingProfile: SortingProfileId;
  onRetry: () => void;
  onSelectSample: (preset: SamplePreset) => void;
  onOpenUpload?: () => void;
  onOpenDeviceCamera?: () => void;
}

const CIRCULARITY_TIERS = ['High Loop', 'Downcycle Path', 'Linear / Landfill'] as const;
const CONTAMINATION_LEVELS = ['Clean Ready', 'Needs Rinse', 'High Contamination'] as const;
const CERTAINTY_LEVELS = ['High Certainty', 'Moderate Certainty', 'Ambiguous Edge Case'] as const;

export const ResultDashboard: React.FC<ResultDashboardProps> = ({
  result,
  isLoading,
  error,
  hasImage,
  activeSortingProfile,
  onRetry,
  onSelectSample,
  onOpenUpload,
  onOpenDeviceCamera,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyReport = async () => {
    if (!result) return;
    const { circularityPotential, contaminationRisk, materialDna, secondLifeArchetype } =
      result.aiCategories;
    const reportText = [
      `SmartBin Waste Report — ${result.itemDetected}`,
      `Category: ${result.primaryCategory} (${result.confidenceScore}% confidence)`,
      `Reason: ${result.reason}`,
      `Disposal Action: ${result.disposalAction}`,
      `Material DNA: ${materialDna.code} — ${materialDna.composition}`,
      `Circularity: ${circularityPotential.score}/100 (${circularityPotential.tier})`,
      `Contamination Risk: ${contaminationRisk.level} — ${contaminationRisk.detail}`,
      `Second-Life Archetype: ${secondLifeArchetype.title} — ${secondLifeArchetype.idea}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  const handleExportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = result.itemDetected.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
    link.download = `smartbin-${safeName || 'report'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading && !result) {
    return (
      <section
        aria-label="Analyzing waste image"
        aria-busy="true"
        className="flex flex-col gap-5 rounded-xl border border-sky-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#101B26]"
      >
        <div className="animate-pulse rounded-lg border border-sky-100 bg-sky-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2.5 flex-1">
              <div className="h-4 w-28 rounded bg-sky-200/70 dark:bg-slate-700" />
              <div className="h-7 w-56 rounded bg-sky-200/70 dark:bg-slate-700" />
              <div className="h-4 w-full max-w-md rounded bg-sky-100 dark:bg-slate-800" />
            </div>
            <div className="h-12 w-20 rounded-lg bg-sky-200/70 dark:bg-slate-700" />
          </div>
        </div>

        <div className="animate-pulse h-14 rounded-lg border border-sky-100 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="animate-pulse h-44 rounded-lg border border-sky-100 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60 md:col-span-2" />
          <div className="animate-pulse h-40 rounded-lg border border-sky-100 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60" />
          <div className="animate-pulse h-40 rounded-lg border border-sky-100 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60" />
          <div className="animate-pulse h-40 rounded-lg border border-sky-100 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60" />
          <div className="animate-pulse h-40 rounded-lg border border-sky-100 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Classification error"
        role="alert"
        className="flex flex-col items-start justify-center gap-4 rounded-xl border border-rose-200 bg-white p-6 shadow-xs dark:border-rose-900/60 dark:bg-[#101B26]"
      >
        <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold">Analysis Could Not Complete</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{error}</p>
        {hasImage && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Retry Analysis</span>
          </button>
        )}
      </section>
    );
  }

  if (!result) {
    const firstPreset = SAMPLE_PRESETS[0];
    return (
      <section
        aria-label="Ready for waste classification"
        className="flex h-full flex-col justify-between gap-6 rounded-xl border border-sky-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#101B26]"
      >
        <div>
          <p className="font-mono text-xs font-medium text-sky-700 dark:text-sky-400">
            Visual Material Inspector
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Upload a photo or select a sample preset to inspect circularity
          </h2>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            SmartBin classifies waste into Recyclable or Non-Recyclable streams, estimates carbon
            diversion, and generates five structured material diagnostics for each scan.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                01. Circularity Potential
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Radial score gauge and recovery loop tier from High Loop to Landfill.
              </p>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                02. Contamination Radar
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Traffic-light signal flagging food grease, moisture, or hazardous parts.
              </p>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                03. Material DNA
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Monospace resin or composite spec badge detailing layer makeup.
              </p>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                04. Second-Life &amp; Edge Cases
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Upcycling concept or safety boundary paired with ambiguity calibration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sky-100 pt-5 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Powered by Gemini Flash structured vision
          </span>
          <button
            type="button"
            onClick={() => onSelectSample(firstPreset)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap cursor-pointer"
          >
            <span>Test Sample: {firstPreset.label}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  if (result.noWasteDetected) {
    const firstPreset = SAMPLE_PRESETS[0];
    return (
      <section
        aria-label="No waste item detected"
        className="flex flex-col justify-between gap-5 rounded-xl border border-orange-200 bg-white p-6 shadow-xs dark:border-orange-900/60 dark:bg-[#101B26]"
      >
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>No Waste Item Detected in Frame</span>
          </div>

          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {result.itemDetected || 'Camera disabled or blank view'}
          </h2>

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {result.reason}
          </p>

          <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              How to detect waste when your webcam is disabled:
            </p>
            <ul className="mt-2 space-y-1.5">
              <li>
                01. Check if your laptop has a physical camera privacy shutter or keyboard camera
                kill key, and enable Camera Access in your OS/browser settings.
              </li>
              <li>
                02. Click <span className="font-semibold">Device Camera App</span> in the Live
                Camera tab (or <span className="font-semibold">Open Full Tab</span>) if the
                embedded preview is restricted.
              </li>
              <li>
                03. Upload, paste (Ctrl+V), or drag-and-drop any JPG, PNG, or WEBP waste photo, or
                test one of the sample presets.
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-sky-100 pt-4 dark:border-slate-800">
          {onOpenUpload && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap cursor-pointer"
            >
              <span>Upload Waste Photo</span>
            </button>
          )}
          {onOpenDeviceCamera && (
            <button
              type="button"
              onClick={onOpenDeviceCamera}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
            >
              <span>Device Camera App</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelectSample(firstPreset)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
          >
            <span>Test {firstPreset.label}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  const isRecyclable = result.primaryCategory === 'Recyclable';
  const { circularityPotential, contaminationRisk, materialDna, secondLifeArchetype, sortingConfidenceNote } =
    result.aiCategories;

  const resultProfile = result.serverMeta?.sortingProfile;
  const profileChangedSinceScan =
    hasImage && resultProfile && resultProfile !== activeSortingProfile;
  const activeProfileObj = SORTING_PROFILES.find((p) => p.id === activeSortingProfile);

  // Radial ring math
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circularityPotential.score / 100) * circumference;

  const ringStrokeClass =
    circularityPotential.tier === 'High Loop'
      ? 'stroke-teal-600 dark:stroke-teal-400'
      : circularityPotential.tier === 'Downcycle Path'
      ? 'stroke-orange-500 dark:stroke-orange-400'
      : 'stroke-rose-500 dark:stroke-rose-400';

  return (
    <section aria-label="Classification results dashboard" className="flex flex-col gap-5">
      {isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-[#101B26] dark:text-slate-300">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <span>Analyzing latest image...</span>
        </div>
      )}

      {profileChangedSinceScan && !isLoading && activeProfileObj && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-2.5 text-xs dark:border-sky-800/70 dark:bg-sky-950/35">
          <span className="text-sky-900 dark:text-sky-200">
            Sorting lens changed to{' '}
            <strong className="font-semibold">{activeProfileObj.label}</strong>.
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Re-check under {activeProfileObj.shortLabel}</span>
          </button>
        </div>
      )}

      {/* 1. Primary Verdict Banner */}
      <div
        className={`rounded-xl border p-5 sm:p-6 shadow-xs ${
          isRecyclable
            ? 'border-teal-200 bg-teal-50/80 dark:border-teal-800/70 dark:bg-teal-950/25'
            : 'border-orange-200 bg-orange-50/80 dark:border-orange-800/70 dark:bg-orange-950/25'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div
              className={`inline-flex items-center gap-2 text-sm font-bold ${
                isRecyclable
                  ? 'text-teal-800 dark:text-teal-300'
                  : 'text-orange-800 dark:text-orange-300'
              }`}
            >
              {isRecyclable ? (
                <Recycle className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Ban className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <span>{result.primaryCategory}</span>
            </div>

            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              {result.itemDetected}
            </h2>

            <p className="max-w-xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.reason}
            </p>

            {result.serverMeta && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600 dark:text-slate-400">
                {result.serverMeta.estimatedCo2SavedKg > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-teal-800 dark:text-teal-300">
                    <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-mono">
                      +{result.serverMeta.estimatedCo2SavedKg.toFixed(2)} kg
                    </span>
                    <span>CO2e avoided</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Zap className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  <span>
                    {result.serverMeta.cached ? 'Cached' : 'Analyzed'} in{' '}
                    {result.serverMeta.latencyMs}ms
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-row flex-wrap sm:flex-col items-center sm:items-end gap-2">
            <div
              className={`flex flex-row sm:flex-col items-baseline sm:items-end justify-between rounded-lg border px-4 py-2.5 ${
                isRecyclable
                  ? 'border-teal-200/90 bg-white/95 dark:border-teal-800/60 dark:bg-slate-900/80'
                  : 'border-orange-200/90 bg-white/95 dark:border-orange-800/60 dark:bg-slate-900/80'
              }`}
            >
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Confidence
              </span>
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {result.confidenceScore}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyReport}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Practical Disposal Action Strip */}
      <div className="flex items-start gap-3 rounded-xl border border-sky-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#101B26]">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isRecyclable
              ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Recommended Disposal Action
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
            {result.disposalAction}
          </p>
        </div>
      </div>

      {/* 3. Five Visually Distinct AI Analytical Modules */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Module 1: Circularity Potential */}
        <article className="rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26] md:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 84 84" aria-hidden="true">
                <circle
                  cx="42"
                  cy="42"
                  r={radius}
                  fill="none"
                  strokeWidth="7"
                  className="stroke-sky-100 dark:stroke-slate-800"
                />
                <circle
                  cx="42"
                  cy="42"
                  r={radius}
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className={`${ringStrokeClass} transition-all duration-500`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                  {circularityPotential.score}
                </span>
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  / 100
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Circularity Potential
                </h3>
                <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {circularityPotential.tier}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5" role="list" aria-label="Circularity loop tier">
                {CIRCULARITY_TIERS.map((tier) => {
                  const active = circularityPotential.tier === tier;
                  const activeTone =
                    tier === 'High Loop'
                      ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950'
                      : tier === 'Downcycle Path'
                      ? 'bg-orange-500 text-white dark:bg-orange-400 dark:text-slate-950'
                      : 'bg-rose-600 text-white dark:bg-rose-500';
                  return (
                    <div
                      key={tier}
                      role="listitem"
                      className={`rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                        active
                          ? activeTone
                          : 'bg-sky-50 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500'
                      }`}
                    >
                      {tier}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {circularityPotential.explanation}
              </p>
            </div>
          </div>
        </article>

        {/* Module 2: Contamination Risk Radar */}
        <article className="flex flex-col justify-between gap-3.5 rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Contamination Risk Radar
              </h3>
              <Droplets className="h-4 w-4 text-sky-500/80" aria-hidden="true" />
            </div>

            <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
                {CONTAMINATION_LEVELS.map((lvl) => {
                  const isActive = contaminationRisk.level === lvl;
                  const dotColor =
                    lvl === 'Clean Ready'
                      ? isActive
                        ? 'bg-teal-500 ring-2 ring-teal-500/30'
                        : 'bg-slate-300 dark:bg-slate-700'
                      : lvl === 'Needs Rinse'
                      ? isActive
                        ? 'bg-orange-500 ring-2 ring-orange-500/30'
                        : 'bg-slate-300 dark:bg-slate-700'
                      : isActive
                      ? 'bg-rose-500 ring-2 ring-rose-500/30'
                      : 'bg-slate-300 dark:bg-slate-700';

                  return <span key={lvl} className={`h-3 w-3 rounded-full ${dotColor}`} />;
                })}
              </div>

              <span
                className={`ml-1 text-xs font-bold ${
                  contaminationRisk.level === 'Clean Ready'
                    ? 'text-teal-700 dark:text-teal-400'
                    : contaminationRisk.level === 'Needs Rinse'
                    ? 'text-orange-700 dark:text-orange-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {contaminationRisk.level}
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {contaminationRisk.detail}
          </p>
        </article>

        {/* Module 3: Material DNA */}
        <article className="flex flex-col justify-between gap-3.5 rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Material DNA
              </h3>
              <Layers className="h-4 w-4 text-sky-500/80" aria-hidden="true" />
            </div>

            <div className="mt-3.5 inline-flex items-center rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2 font-mono text-sm font-bold tracking-tight text-sky-900 dark:border-slate-700 dark:bg-slate-950 dark:text-sky-300">
              {materialDna.code}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {materialDna.composition}
          </p>
        </article>

        {/* Module 4: Second-Life Archetype */}
        <article
          className={`flex flex-col justify-between gap-3 rounded-xl border p-5 shadow-xs ${
            secondLifeArchetype.isRepurposable
              ? 'border-sky-200 bg-sky-50/55 dark:border-sky-900/60 dark:bg-sky-950/20'
              : 'border-orange-200/80 bg-orange-50/45 dark:border-slate-800 dark:bg-slate-900/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Second-Life Archetype
              </h3>
              {secondLifeArchetype.isRepurposable ? (
                <Wrench className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
              )}
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
              {secondLifeArchetype.isRepurposable ? (
                <span className="inline-flex items-center gap-1.5 text-sky-800 dark:text-sky-300">
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{secondLifeArchetype.title}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-orange-800 dark:text-orange-300">
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{secondLifeArchetype.title}</span>
                </span>
              )}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {secondLifeArchetype.idea}
          </p>
        </article>

        {/* Module 5: Sorting Confidence & Edge Cases */}
        <article className="flex flex-col justify-between gap-3 rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Sorting Confidence &amp; Edge Cases
              </h3>
              <HelpCircle className="h-4 w-4 text-sky-500/80" aria-hidden="true" />
            </div>

            <div className="mt-3.5 space-y-1.5">
              <div className="grid grid-cols-3 gap-1">
                {CERTAINTY_LEVELS.map((lvl, idx) => {
                  const activeIndex = CERTAINTY_LEVELS.indexOf(sortingConfidenceNote.certaintyLabel);
                  const filled =
                    sortingConfidenceNote.certaintyLabel === 'High Certainty'
                      ? true
                      : sortingConfidenceNote.certaintyLabel === 'Moderate Certainty'
                      ? idx <= 1
                      : idx === 0;
                  const barTone =
                    activeIndex === 0
                      ? 'bg-teal-500'
                      : activeIndex === 1
                      ? 'bg-orange-500'
                      : 'bg-rose-500';
                  return (
                    <div
                      key={lvl}
                      className={`h-1.5 rounded-sm ${
                        filled ? barTone : 'bg-sky-100 dark:bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                {sortingConfidenceNote.certaintyLabel}
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {sortingConfidenceNote.ambiguityNote}
          </p>
        </article>
      </div>
    </section>
  );
};
