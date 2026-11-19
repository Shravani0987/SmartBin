import { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Header } from './components/Header';
import { CapturePanel, type InputMode } from './components/CapturePanel';
import { ResultDashboard } from './components/ResultDashboard';
import { ScanHistoryStrip } from './components/ScanHistoryStrip';
import { DashboardSection } from './components/DashboardSection';
import { SortingGuideSection } from './components/SortingGuideSection';
import { Footer } from './components/Footer';
import {
  classifyWasteImage,
  clearServerScans,
  deleteServerScan,
  downscaleImageUrl,
  fetchServerScans,
  prepareFileForClassification,
  prepareUrlForClassification,
  type PreparedImage,
} from './services/wasteClassifier';
import { SORTING_PROFILES } from './data/presets';
import type {
  SamplePreset,
  ScanHistoryItem,
  ServerAnalyticsStats,
  SortingProfileId,
  WasteClassificationResult,
} from './types/waste';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('ecolens-theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem('ecolens-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [sortingProfile, setSortingProfile] = useState<SortingProfileId>('standard');
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [result, setResult] = useState<WasteClassificationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<ServerAnalyticsStats | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('ecolens-scan-history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ScanHistoryItem[]) : [];
    } catch {
      return [];
    }
  });
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('ecolens-scan-history', JSON.stringify(history));
    } catch {
      // Ignore storage quota errors if large data URLs exceed browser limit
    }
  }, [history]);

  const refreshServerStats = useCallback(async () => {
    const data = await fetchServerScans();
    if (data?.stats) {
      setServerStats(data.stats);
    }
  }, []);

  useEffect(() => {
    void refreshServerStats();
  }, [refreshServerStats]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const requestCounterRef = useRef(0);

  const runClassification = useCallback(
    async (img: PreparedImage, profileOverride?: SortingProfileId) => {
      const requestId = ++requestCounterRef.current;
      const activeProfile = profileOverride ?? sortingProfile;
      setIsAnalyzing(true);
      setError(null);

      try {
        const classification = await classifyWasteImage(img.base64, img.mimeType, activeProfile);
        if (requestCounterRef.current !== requestId) return;

        setResult(classification);
        if (!classification.noWasteDetected) {
          const historyItem: ScanHistoryItem = {
            id:
              classification.serverMeta?.id ??
              `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: classification.serverMeta?.timestamp ?? Date.now(),
            imageSrc: img.previewUrl,
            sortingProfile: activeProfile,
            estimatedCo2SavedKg: classification.serverMeta?.estimatedCo2SavedKg,
            latencyMs: classification.serverMeta?.latencyMs,
            cached: classification.serverMeta?.cached,
            result: classification,
          };
          setHistory((prev) => [historyItem, ...prev].slice(0, 24));
          setActiveHistoryId(historyItem.id);
          void refreshServerStats();
        }
      } catch (err: unknown) {
        if (requestCounterRef.current !== requestId) return;
        const msg =
          err instanceof Error ? err.message : 'Unable to classify this image. Please try again.';
        setError(msg);
        setResult(null);
      } finally {
        if (requestCounterRef.current === requestId) {
          setIsAnalyzing(false);
        }
      }
    },
    [sortingProfile, refreshServerStats]
  );

  const handleBatchFilesSelected = useCallback(
    async (files: File[]) => {
      const validFiles = files.slice(0, 8);
      if (validFiles.length === 0) return;

      setInputMode('upload');
      setActivePresetId(null);
      setActiveHistoryId(null);
      setError(null);

      for (let idx = 0; idx < validFiles.length; idx++) {
        const file = validFiles[idx];
        setBatchProgress({
          current: idx + 1,
          total: validFiles.length,
          fileName: file.name,
        });

        try {
          const prepared = await prepareFileForClassification(file);
          setPreparedImage(prepared);
          await runClassification(prepared);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : `Failed to process ${file.name}.`;
          setError(msg);
        }
      }

      setBatchProgress(null);
    },
    [runClassification]
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      setInputMode('upload');
      setActivePresetId(null);
      setActiveHistoryId(null);
      setError(null);
      setResult(null);

      try {
        const prepared = await prepareFileForClassification(file);
        setPreparedImage(prepared);
        await runClassification(prepared);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not read the selected image.';
        setError(msg);
      }
    },
    [runClassification]
  );

  // Global clipboard image paste support (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void handleFileSelected(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileSelected]);

  const handleCameraCaptured = useCallback(
    async (dataUrl: string, options?: { keepCameraOpen?: boolean }) => {
      setActivePresetId(null);
      setActiveHistoryId(null);
      setError(null);
      if (!options?.keepCameraOpen) {
        setResult(null);
      }

      try {
        const prepared = await downscaleImageUrl(dataUrl, 'image/jpeg');
        setPreparedImage(prepared);
        await runClassification(prepared);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to process captured camera frame.';
        setError(msg);
      }
    },
    [runClassification]
  );

  const handlePresetSelected = useCallback(
    async (preset: SamplePreset) => {
      setInputMode('upload');
      setActivePresetId(preset.id);
      setActiveHistoryId(null);
      setError(null);
      setResult(null);

      try {
        const prepared = await prepareUrlForClassification(preset.imageUrl);
        setPreparedImage(prepared);
        await runClassification(prepared);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load sample preset image.';
        setError(msg);
      }
    },
    [runClassification]
  );

  const handleReanalyze = useCallback(() => {
    if (preparedImage && !isAnalyzing) {
      void runClassification(preparedImage);
    }
  }, [preparedImage, isAnalyzing, runClassification]);

  const handleClearImage = useCallback(() => {
    requestCounterRef.current += 1;
    setPreparedImage(null);
    setActivePresetId(null);
    setActiveHistoryId(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  const handleSelectHistoryItem = useCallback((item: ScanHistoryItem) => {
    setInputMode('upload');
    setActivePresetId(null);
    setActiveHistoryId(item.id);
    setError(null);
    setIsAnalyzing(false);
    setResult(item.result);
    const base64 = item.imageSrc.split(',')[1] ?? '';
    setPreparedImage({
      previewUrl: item.imageSrc,
      base64,
      mimeType: 'image/jpeg',
    });
  }, []);

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    setActiveHistoryId((prev) => (prev === id ? null : prev));
    const stats = await deleteServerScan(id);
    if (stats) {
      setServerStats(stats);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    setHistory([]);
    setActiveHistoryId(null);
    const stats = await clearServerScans();
    if (stats) {
      setServerStats(stats);
    }
  }, []);

  const handleHeaderUpload = useCallback(() => {
    setInputMode('upload');
    const analyzerEl = document.getElementById('analyzer');
    analyzerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F8FB] text-slate-900 dark:bg-[#0A121A] dark:text-slate-100">
      <Header onQuickUploadClick={handleHeaderUpload} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Workspace Hero & Theme Toolbar */}
        <div
          id="analyzer"
          className="mb-6 flex flex-col gap-4 border-b border-sky-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800"
        >
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white text-balance">
              Waste Classification &amp; Material Circularity
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Inspect any discarded item via photo upload, clipboard paste, or live camera to
              classify recyclability, contamination risk, polymer DNA, and carbon impact.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex min-h-[40px] self-start sm:self-auto items-center gap-2 rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-800 dark:bg-[#101B26] dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>Light Surface</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-sky-600" aria-hidden="true" />
                <span>Dark Surface</span>
              </>
            )}
          </button>
        </div>

        {/* Regional Municipal Sorting Rule Lens */}
        <div className="mb-6 flex flex-col gap-2.5 rounded-xl border border-sky-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#101B26]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Municipal Sorting Rule Lens
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {SORTING_PROFILES.find((p) => p.id === sortingProfile)?.description}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Select municipal sorting strictness profile"
            className="inline-flex flex-wrap rounded-lg bg-sky-50/90 p-1 dark:bg-slate-800/80 shrink-0"
          >
            {SORTING_PROFILES.map((profile) => {
              const active = sortingProfile === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSortingProfile(profile.id)}
                  className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {profile.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Asymmetric Split Console */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5">
            <CapturePanel
              inputMode={inputMode}
              onModeChange={setInputMode}
              activeImageSrc={preparedImage?.previewUrl ?? null}
              activePresetId={activePresetId}
              isAnalyzing={isAnalyzing}
              batchProgress={batchProgress}
              fileInputRef={fileInputRef}
              nativeCameraInputRef={nativeCameraInputRef}
              onFileSelected={handleFileSelected}
              onBatchFilesSelected={handleBatchFilesSelected}
              onCameraCaptured={handleCameraCaptured}
              onPresetSelected={handlePresetSelected}
              onClearImage={handleClearImage}
              onReanalyze={handleReanalyze}
            />
          </div>

          <div className="lg:col-span-7">
            <ResultDashboard
              result={result}
              isLoading={isAnalyzing}
              error={error}
              hasImage={Boolean(preparedImage)}
              activeSortingProfile={sortingProfile}
              onRetry={handleReanalyze}
              onSelectSample={handlePresetSelected}
              onOpenUpload={handleHeaderUpload}
              onOpenDeviceCamera={() => nativeCameraInputRef.current?.click()}
            />
          </div>
        </div>

        {/* Session Scan History */}
        <div className="mt-8">
          <ScanHistoryStrip
            items={history}
            activeItemId={activeHistoryId}
            onSelect={handleSelectHistoryItem}
            onDeleteItem={handleDeleteHistoryItem}
            onClearHistory={handleClearHistory}
          />
        </div>

        {/* D3 Scan History Analytics */}
        <div className="mt-8">
          <DashboardSection
            items={history}
            serverStats={serverStats}
            onSelectScan={handleSelectHistoryItem}
            onRunSamplePreset={handlePresetSelected}
          />
        </div>

        {/* Material Sorting Reference */}
        <div className="mt-10">
          <SortingGuideSection />
        </div>
      </main>

      <Footer />
    </div>
  );
}
