import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ArrowRight, Ban, BarChart3, Download, Leaf, Recycle, Search, Table2 } from 'lucide-react';
import type { SamplePreset, ScanHistoryItem, ServerAnalyticsStats } from '../types/waste';
import { SAMPLE_PRESETS } from '../data/presets';

interface DashboardSectionProps {
  items: ScanHistoryItem[];
  serverStats?: ServerAnalyticsStats | null;
  onSelectScan: (item: ScanHistoryItem) => void;
  onRunSamplePreset: (preset: SamplePreset) => void;
}

type StreamFilter = 'all' | 'recyclable' | 'non-recyclable';
type ChartMode = 'cumulative' | 'timeline';
type DashboardView = 'charts' | 'table';

interface TimelinePoint {
  index: number;
  timestamp: number;
  date: Date;
  item: ScanHistoryItem;
  recyclableTotal: number;
  nonRecyclableTotal: number;
  isRecyclable: boolean;
  circularityScore: number;
}

function escapeCsvField(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  items,
  serverStats,
  onSelectScan,
  onRunSamplePreset,
}) => {
  const [view, setView] = useState<DashboardView>('charts');
  const [filter, setFilter] = useState<StreamFilter>('all');
  const [chartMode, setChartMode] = useState<ChartMode>('cumulative');
  const [tableQuery, setTableQuery] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(640);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.max(280, Math.floor(el.clientWidth));
      setChartWidth(next);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [items.length, view]);

  const chronologicalItems = useMemo(() => {
    return [...items].sort((a, b) => a.timestamp - b.timestamp);
  }, [items]);

  const timelineData = useMemo<TimelinePoint[]>(() => {
    let recCount = 0;
    let nonRecCount = 0;

    return chronologicalItems.map((item, idx) => {
      const isRec = item.result.primaryCategory === 'Recyclable';
      if (isRec) recCount += 1;
      else nonRecCount += 1;

      return {
        index: idx,
        timestamp: item.timestamp,
        date: new Date(item.timestamp),
        item,
        recyclableTotal: recCount,
        nonRecyclableTotal: nonRecCount,
        isRecyclable: isRec,
        circularityScore: item.result.aiCategories.circularityPotential.score,
      };
    });
  }, [chronologicalItems]);

  const filteredTimelineData = useMemo(() => {
    if (filter === 'all') return timelineData;
    if (filter === 'recyclable') return timelineData.filter((d) => d.isRecyclable);
    return timelineData.filter((d) => !d.isRecyclable);
  }, [timelineData, filter]);

  const filteredTableItems = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStream =
        filter === 'all' ||
        (filter === 'recyclable' && item.result.primaryCategory === 'Recyclable') ||
        (filter === 'non-recyclable' && item.result.primaryCategory === 'Non-Recyclable');
      if (!matchesStream) return false;
      if (!q) return true;
      return (
        item.result.itemDetected.toLowerCase().includes(q) ||
        item.result.aiCategories.materialDna.code.toLowerCase().includes(q) ||
        item.result.aiCategories.contaminationRisk.level.toLowerCase().includes(q)
      );
    });
  }, [items, filter, tableQuery]);

  const summaryStats = useMemo(() => {
    const total = items.length;
    const recyclableCount = items.filter((i) => i.result.primaryCategory === 'Recyclable').length;
    const nonRecyclableCount = total - recyclableCount;
    const diversionRate = total > 0 ? Math.round((recyclableCount / total) * 100) : 0;
    const cleanReadyCount = items.filter(
      (i) => i.result.aiCategories.contaminationRisk.level === 'Clean Ready'
    ).length;
    const cleanReadyRate = total > 0 ? Math.round((cleanReadyCount / total) * 100) : 0;
    const avgCircularity =
      total > 0
        ? Math.round(
            items.reduce(
              (acc, cur) => acc + cur.result.aiCategories.circularityPotential.score,
              0
            ) / total
          )
        : 0;

    const localCo2 = items.reduce(
      (acc, cur) =>
        acc +
        (cur.estimatedCo2SavedKg ??
          cur.result.serverMeta?.estimatedCo2SavedKg ??
          (cur.result.primaryCategory === 'Recyclable' ? 0.08 : 0)),
      0
    );
    const estimatedCo2SavedKg =
      serverStats && serverStats.totalScans >= total
        ? serverStats.estimatedCo2SavedKg
        : Number(localCo2.toFixed(2));

    const materialMap = new Map<string, number>();
    for (const item of items) {
      const code = (item.result.aiCategories.materialDna.code || 'UNKNOWN').trim().toUpperCase();
      materialMap.set(code, (materialMap.get(code) ?? 0) + 1);
    }
    const topMaterials =
      materialMap.size > 0
        ? Array.from(materialMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([code, count]) => ({ code, count }))
        : serverStats?.topMaterials ?? [];

    return {
      total,
      recyclableCount,
      nonRecyclableCount,
      diversionRate,
      cleanReadyCount,
      cleanReadyRate,
      avgCircularity,
      estimatedCo2SavedKg,
      topMaterials,
    };
  }, [items, serverStats]);

  const handleExportCsv = () => {
    if (serverStats && serverStats.totalScans > 0) {
      const link = document.createElement('a');
      link.href = '/api/scans/export.csv';
      link.download = `smartbin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (items.length === 0) return;
    const headers = [
      'Timestamp',
      'Item Detected',
      'Primary Category',
      'Confidence (%)',
      'Circularity Score',
      'Circularity Tier',
      'Contamination Risk',
      'Material DNA',
      'Sorting Rule Profile',
      'Disposal Action',
    ];
    const rows = items.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.result.itemDetected,
      entry.result.primaryCategory,
      entry.result.confidenceScore,
      entry.result.aiCategories.circularityPotential.score,
      entry.result.aiCategories.circularityPotential.tier,
      entry.result.aiCategories.contaminationRisk.level,
      entry.result.aiCategories.materialDna.code,
      entry.sortingProfile ?? 'standard',
      entry.result.disposalAction,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvField).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartbin-scan-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // D3 Layout Math for Timeline Chart
  const chartHeight = 260;
  const margin = { top: 20, right: 20, bottom: 38, left: 40 };
  const innerWidth = Math.max(180, chartWidth - margin.left - margin.right);
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const timelineGeometry = useMemo(() => {
    const data = chartMode === 'cumulative' ? timelineData : filteredTimelineData;
    if (data.length === 0) return null;

    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, data.length - 1)])
      .range([
        data.length === 1 ? innerWidth / 2 : 8,
        data.length === 1 ? innerWidth / 2 : innerWidth - 8,
      ]);

    const maxY =
      chartMode === 'cumulative'
        ? Math.max(
            2,
            d3.max(data, (d) => Math.max(d.recyclableTotal, d.nonRecyclableTotal)) ?? 2
          )
        : 100;

    const yScale = d3.scaleLinear().domain([0, maxY]).nice().range([innerHeight, 0]);

    const yTicks = yScale
      .ticks(chartMode === 'cumulative' ? Math.min(5, maxY) : 5)
      .filter((t) => (chartMode === 'cumulative' ? Number.isInteger(t) : true));

    const xTickIndices =
      data.length <= 5
        ? data.map((_, i) => i)
        : Array.from(
            new Set([
              0,
              Math.floor((data.length - 1) * 0.25),
              Math.floor((data.length - 1) * 0.5),
              Math.floor((data.length - 1) * 0.75),
              data.length - 1,
            ])
          );

    const timeFmt = d3.timeFormat('%H:%M:%S');

    const recAreaGen = d3
      .area<TimelinePoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScale(d.recyclableTotal))
      .curve(d3.curveMonotoneX);

    const recLineGen = d3
      .line<TimelinePoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.recyclableTotal))
      .curve(d3.curveMonotoneX);

    const nonRecAreaGen = d3
      .area<TimelinePoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScale(d.nonRecyclableTotal))
      .curve(d3.curveMonotoneX);

    const nonRecLineGen = d3
      .line<TimelinePoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.nonRecyclableTotal))
      .curve(d3.curveMonotoneX);

    return {
      data,
      xScale,
      yScale,
      yTicks,
      xTickIndices,
      timeFmt,
      recAreaPath: recAreaGen(data) ?? '',
      recLinePath: recLineGen(data) ?? '',
      nonRecAreaPath: nonRecAreaGen(data) ?? '',
      nonRecLinePath: nonRecLineGen(data) ?? '',
    };
  }, [chartMode, timelineData, filteredTimelineData, innerWidth, innerHeight]);

  const donutGeometry = useMemo(() => {
    if (summaryStats.total === 0) return null;

    const pieData = [
      {
        key: 'Recyclable',
        value: summaryStats.recyclableCount,
        colorClass: 'fill-teal-600 dark:fill-teal-400',
      },
      {
        key: 'Non-Recyclable',
        value: summaryStats.nonRecyclableCount,
        colorClass: 'fill-orange-500 dark:fill-orange-400',
      },
    ].filter((d) => d.value > 0);

    const pieGen = d3
      .pie<{ key: string; value: number; colorClass: string }>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(pieData.length > 1 ? 0.04 : 0);

    const arcGen = d3
      .arc<d3.PieArcDatum<{ key: string; value: number; colorClass: string }>>()
      .innerRadius(52)
      .outerRadius(76)
      .cornerRadius(4);

    return pieGen(pieData).map((slice) => ({
      ...slice.data,
      path: arcGen(slice) ?? '',
    }));
  }, [summaryStats]);

  const activeHoverPoint =
    hoveredIndex !== null && timelineGeometry?.data[hoveredIndex]
      ? timelineGeometry.data[hoveredIndex]
      : null;

  return (
    <section
      id="analytics"
      aria-label="Scan history analytics dashboard"
      className="rounded-xl border border-sky-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-[#101B26]"
    >
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Scan History Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Recyclable vs Non-Recyclable materials and CO2e diversion tracked across scans.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode: Charts vs Audit Table */}
            <div
              role="tablist"
              aria-label="Dashboard view"
              className="inline-flex rounded-lg bg-sky-50/90 p-1 dark:bg-slate-800/80"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === 'charts'}
                onClick={() => setView('charts')}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === 'charts'
                    ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Charts</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'table'}
                onClick={() => setView('table')}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === 'table'
                    ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Audit Table</span>
              </button>
            </div>

            {view === 'charts' && (
              <div
                role="tablist"
                aria-label="Chart visualization mode"
                className="inline-flex rounded-lg bg-sky-50/90 p-1 dark:bg-slate-800/80"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === 'cumulative'}
                  onClick={() => {
                    setChartMode('cumulative');
                    setHoveredIndex(null);
                  }}
                  className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartMode === 'cumulative'
                      ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Cumulative Trend
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === 'timeline'}
                  onClick={() => {
                    setChartMode('timeline');
                    setHoveredIndex(null);
                  }}
                  className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartMode === 'timeline'
                      ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Per-Scan Circularity
                </button>
              </div>
            )}

            {/* Stream Filter */}
            <div
              role="group"
              aria-label="Filter stream category"
              className="inline-flex rounded-lg bg-sky-50/90 p-1 dark:bg-slate-800/80"
            >
              {(['all', 'recyclable', 'non-recyclable'] as const).map((key) => {
                const label =
                  key === 'all' ? 'All' : key === 'recyclable' ? 'Recyclable' : 'Non-Recyclable';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilter(key);
                      setHoveredIndex(null);
                    }}
                    className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filter === key
                        ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 dark:border-slate-800 dark:bg-slate-900 dark:text-sky-400">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              No scan history recorded yet
            </h3>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Each waste item you upload, capture, or test with a sample preset is persisted on the
              server and plotted here to track your Recyclable vs Non-Recyclable diversion ratio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunSamplePreset(SAMPLE_PRESETS[0])}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap cursor-pointer"
          >
            <span>Scan First Sample</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* 5-Column Summary KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-sky-100 bg-sky-50/45 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Items Scanned
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {summaryStats.total}
              </p>
            </div>

            <div className="rounded-lg border border-sky-100 bg-sky-50/45 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Recyclable Diversion
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {summaryStats.diversionRate}%
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {summaryStats.recyclableCount}/{summaryStats.total}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-sky-100 bg-sky-50/45 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Mean Circularity
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  {summaryStats.avgCircularity}
                </span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">/ 100</span>
              </div>
            </div>

            <div className="rounded-lg border border-sky-100 bg-sky-50/45 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Clean-Ready Rate
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  {summaryStats.cleanReadyRate}%
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {summaryStats.cleanReadyCount} clean
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-lg border border-teal-200/80 bg-teal-50/55 px-4 py-3 dark:border-teal-900/60 dark:bg-teal-950/25">
              <p className="flex items-center gap-1.5 text-xs font-medium text-teal-800 dark:text-teal-300">
                <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Est. CO2e Avoided</span>
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-teal-800 dark:text-teal-300">
                  {summaryStats.estimatedCo2SavedKg.toFixed(2)}
                </span>
                <span className="font-mono text-xs text-teal-700 dark:text-teal-400">kg</span>
              </div>
            </div>
          </div>

          {summaryStats.topMaterials.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/35 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/40">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Top Material DNA:
              </span>
              {summaryStats.topMaterials.map((mat) => (
                <span
                  key={mat.code}
                  className="inline-flex items-center gap-1.5 rounded border border-sky-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-900 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300"
                >
                  <span>{mat.code}</span>
                  <span className="text-slate-400">×{mat.count}</span>
                </span>
              ))}
            </div>
          )}

          {view === 'charts' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
              {/* Left 8 cols: D3 Time-Series Chart */}
              <div className="flex flex-col justify-between rounded-lg border border-sky-100 bg-sky-50/30 p-4 dark:border-slate-800 dark:bg-slate-900/35 lg:col-span-8">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {chartMode === 'cumulative'
                      ? 'Cumulative Materials Identified Over Time'
                      : 'Circularity Score by Scan Timestamp'}
                  </span>

                  <div className="flex items-center gap-4 text-xs font-medium">
                    {(filter === 'all' || filter === 'recyclable') && (
                      <span className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                        <Recycle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Recyclable</span>
                      </span>
                    )}
                    {(filter === 'all' || filter === 'non-recyclable') && (
                      <span className="inline-flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Non-Recyclable</span>
                      </span>
                    )}
                  </div>
                </div>

                <div ref={chartContainerRef} className="relative w-full overflow-hidden">
                  {timelineGeometry && timelineGeometry.data.length > 0 ? (
                    <svg
                      width={chartWidth}
                      height={chartHeight}
                      role="img"
                      aria-label="D3 chart showing Recyclable versus Non-Recyclable scan history over time"
                      className="block select-none"
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <defs>
                        <linearGradient id="ecolens-rec-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="ecolens-nonrec-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ea580c" stopOpacity="0.24" />
                          <stop offset="100%" stopColor="#ea580c" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      <g transform={`translate(${margin.left}, ${margin.top})`}>
                        {timelineGeometry.yTicks.map((tick) => {
                          const yPos = timelineGeometry.yScale(tick);
                          return (
                            <g key={tick} transform={`translate(0, ${yPos})`}>
                              <line
                                x1={0}
                                x2={innerWidth}
                                className="stroke-sky-200/70 dark:stroke-slate-800"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={-10}
                                dy="0.32em"
                                textAnchor="end"
                                className="fill-slate-400 font-mono text-[11px] dark:fill-slate-500"
                              >
                                {tick}
                              </text>
                            </g>
                          );
                        })}

                        <line
                          x1={0}
                          x2={innerWidth}
                          y1={innerHeight}
                          y2={innerHeight}
                          className="stroke-sky-200 dark:stroke-slate-700"
                        />

                        {timelineGeometry.xTickIndices.map((idx) => {
                          const pt = timelineGeometry.data[idx];
                          if (!pt) return null;
                          const xPos = timelineGeometry.xScale(idx);
                          return (
                            <g key={pt.item.id} transform={`translate(${xPos}, ${innerHeight})`}>
                              <line
                                y1={0}
                                y2={5}
                                className="stroke-sky-200 dark:stroke-slate-700"
                              />
                              <text
                                y={18}
                                textAnchor="middle"
                                className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                              >
                                {timelineGeometry.timeFmt(pt.date)}
                              </text>
                            </g>
                          );
                        })}

                        {chartMode === 'cumulative' ? (
                          <>
                            {(filter === 'all' || filter === 'recyclable') &&
                              timelineGeometry.data.length > 1 && (
                                <>
                                  <path
                                    d={timelineGeometry.recAreaPath}
                                    fill="url(#ecolens-rec-grad)"
                                  />
                                  <path
                                    d={timelineGeometry.recLinePath}
                                    fill="none"
                                    strokeWidth={2.25}
                                    className="stroke-teal-600 dark:stroke-teal-400"
                                  />
                                </>
                              )}

                            {(filter === 'all' || filter === 'non-recyclable') &&
                              timelineGeometry.data.length > 1 && (
                                <>
                                  <path
                                    d={timelineGeometry.nonRecAreaPath}
                                    fill="url(#ecolens-nonrec-grad)"
                                  />
                                  <path
                                    d={timelineGeometry.nonRecLinePath}
                                    fill="none"
                                    strokeWidth={2.25}
                                    className="stroke-orange-500 dark:stroke-orange-400"
                                  />
                                </>
                              )}

                            {hoveredIndex !== null && timelineGeometry.data[hoveredIndex] && (
                              <line
                                x1={timelineGeometry.xScale(hoveredIndex)}
                                x2={timelineGeometry.xScale(hoveredIndex)}
                                y1={0}
                                y2={innerHeight}
                                className="stroke-sky-400 dark:stroke-slate-500"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                              />
                            )}

                            {timelineGeometry.data.map((pt, idx) => {
                              const cx = timelineGeometry.xScale(idx);
                              const cyRec = timelineGeometry.yScale(pt.recyclableTotal);
                              const cyNon = timelineGeometry.yScale(pt.nonRecyclableTotal);
                              const isHovered = hoveredIndex === idx;

                              return (
                                <g
                                  key={pt.item.id}
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredIndex(idx)}
                                  onClick={() => onSelectScan(pt.item)}
                                >
                                  <rect
                                    x={cx - 14}
                                    y={0}
                                    width={28}
                                    height={innerHeight}
                                    fill="transparent"
                                  />
                                  {(filter === 'all' || filter === 'recyclable') && (
                                    <circle
                                      cx={cx}
                                      cy={cyRec}
                                      r={isHovered ? 5.5 : 3.75}
                                      className="fill-teal-600 stroke-white stroke-2 dark:fill-teal-400 dark:stroke-slate-900"
                                    />
                                  )}
                                  {(filter === 'all' || filter === 'non-recyclable') && (
                                    <circle
                                      cx={cx}
                                      cy={cyNon}
                                      r={isHovered ? 5.5 : 3.75}
                                      className="fill-orange-500 stroke-white stroke-2 dark:fill-orange-400 dark:stroke-slate-900"
                                    />
                                  )}
                                </g>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            {timelineGeometry.data.map((pt, idx) => {
                              const cx = timelineGeometry.xScale(idx);
                              const barWidth = Math.min(
                                26,
                                Math.max(
                                  10,
                                  Math.floor(
                                    innerWidth / Math.max(4, timelineGeometry.data.length * 1.8)
                                  )
                                )
                              );
                              const yTop = timelineGeometry.yScale(pt.circularityScore);
                              const barHeight = Math.max(4, innerHeight - yTop);
                              const isHovered = hoveredIndex === idx;

                              return (
                                <g
                                  key={pt.item.id}
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredIndex(idx)}
                                  onClick={() => onSelectScan(pt.item)}
                                >
                                  <rect
                                    x={cx - barWidth / 2}
                                    y={yTop}
                                    width={barWidth}
                                    height={barHeight}
                                    rx={4}
                                    className={`transition-opacity ${
                                      pt.isRecyclable
                                        ? 'fill-teal-600 dark:fill-teal-400'
                                        : 'fill-orange-500 dark:fill-orange-400'
                                    } ${isHovered ? 'opacity-100' : 'opacity-85'}`}
                                  />
                                </g>
                              );
                            })}
                          </>
                        )}
                      </g>
                    </svg>
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      No scans match the selected category filter.
                    </div>
                  )}

                  <div className="mt-2 flex min-h-[38px] items-center justify-between gap-3 rounded-md border border-sky-100 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                    {activeHoverPoint ? (
                      <>
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`font-semibold whitespace-nowrap ${
                              activeHoverPoint.isRecyclable
                                ? 'text-teal-700 dark:text-teal-400'
                                : 'text-orange-700 dark:text-orange-400'
                            }`}
                          >
                            {activeHoverPoint.item.result.primaryCategory}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {activeHoverPoint.item.result.itemDetected}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                          <span>Circularity {activeHoverPoint.circularityScore}/100</span>
                          <span>
                            Split {activeHoverPoint.recyclableTotal}R /{' '}
                            {activeHoverPoint.nonRecyclableTotal}N
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        Hover any point to inspect scan details, or click a point to reopen its full
                        material report.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right 4 cols: D3 Proportional Donut */}
              <div className="flex flex-col justify-between rounded-lg border border-sky-100 bg-sky-50/30 p-4 dark:border-slate-800 dark:bg-slate-900/35 lg:col-span-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Stream Breakdown
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {summaryStats.total} {summaryStats.total === 1 ? 'scan' : 'scans'}
                  </span>
                </div>

                <div className="my-4 flex items-center justify-center">
                  {donutGeometry && (
                    <div className="relative h-44 w-44">
                      <svg
                        viewBox="-88 -88 176 176"
                        className="h-full w-full"
                        role="img"
                        aria-label={`Donut chart showing ${summaryStats.diversionRate}% Recyclable and ${100 - summaryStats.diversionRate}% Non-Recyclable`}
                      >
                        {donutGeometry.map((slice) => (
                          <path key={slice.key} d={slice.path} className={slice.colorClass} />
                        ))}
                      </svg>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                          {summaryStats.diversionRate}%
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Recyclable
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-sky-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 font-medium text-teal-700 dark:text-teal-400">
                      <Recycle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Recyclable</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {summaryStats.recyclableCount} ({summaryStats.diversionRate}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 font-medium text-orange-700 dark:text-orange-400">
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Non-Recyclable</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {summaryStats.nonRecyclableCount} ({100 - summaryStats.diversionRate}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Searchable Audit Log Table */
            <div className="space-y-3">
              <div className="relative max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={tableQuery}
                  onChange={(e) => setTableQuery(e.target.value)}
                  placeholder="Search item, Material DNA, or contamination..."
                  aria-label="Search scan audit table"
                  className="min-h-[38px] w-full rounded-lg border border-sky-200 bg-sky-50/40 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-sky-100 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-sky-100 bg-sky-50/60 text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Item</th>
                      <th className="px-3.5 py-2.5 font-semibold">Stream</th>
                      <th className="px-3.5 py-2.5 font-semibold">Material DNA</th>
                      <th className="px-3.5 py-2.5 font-semibold">Contamination</th>
                      <th className="px-3.5 py-2.5 text-right font-semibold">Circularity</th>
                      <th className="px-3.5 py-2.5 text-right font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100 dark:divide-slate-800">
                    {filteredTableItems.length > 0 ? (
                      filteredTableItems.map((entry) => {
                        const isRec = entry.result.primaryCategory === 'Recyclable';
                        return (
                          <tr
                            key={entry.id}
                            onClick={() => onSelectScan(entry)}
                            className="cursor-pointer transition-colors hover:bg-sky-50/60 dark:hover:bg-slate-900/50"
                          >
                            <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={entry.imageSrc}
                                  alt={entry.result.itemDetected}
                                  referrerPolicy="no-referrer"
                                  className="h-8 w-8 shrink-0 rounded object-cover bg-sky-100 dark:bg-slate-800"
                                />
                                <span className="max-w-[220px] truncate">
                                  {entry.result.itemDetected}
                                </span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 font-semibold ${
                                  isRec
                                    ? 'text-teal-700 dark:text-teal-400'
                                    : 'text-orange-700 dark:text-orange-400'
                                }`}
                              >
                                {isRec ? (
                                  <Recycle className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                <span>{entry.result.primaryCategory}</span>
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {entry.result.aiCategories.materialDna.code}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {entry.result.aiCategories.contaminationRisk.level}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              {entry.result.aiCategories.circularityPotential.score}/100
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3.5 py-6 text-center text-slate-500 dark:text-slate-400"
                        >
                          No matching scans found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
