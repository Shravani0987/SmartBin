import fs from 'fs';
import path from 'path';
import type {
  ServerAnalyticsStats,
  SortingProfileId,
  WasteClassificationResult,
} from '../src/types/waste.ts';

export interface StoredScanRecord {
  id: string;
  timestamp: number;
  sortingProfile: SortingProfileId;
  modelUsed: string;
  latencyMs: number;
  cached: boolean;
  estimatedCo2SavedKg: number;
  result: WasteClassificationResult;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');
const MAX_STORED_SCANS = 100;

let memoryScans: StoredScanRecord[] | null = null;

function ensureLoaded(): StoredScanRecord[] {
  if (memoryScans !== null) return memoryScans;

  try {
    if (fs.existsSync(SCANS_FILE)) {
      const raw = fs.readFileSync(SCANS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryScans = parsed as StoredScanRecord[];
        return memoryScans;
      }
    }
  } catch (err) {
    console.warn('[SmartBin ScanStore] Failed to load scans.json, starting fresh:', err);
  }

  memoryScans = [];
  return memoryScans;
}

function persistToDisk(scans: StoredScanRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${SCANS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(scans, null, 2), 'utf-8');
    fs.renameSync(tmpFile, SCANS_FILE);
  } catch (err) {
    console.warn('[SmartBin ScanStore] Could not persist scans.json:', err);
  }
}

export function appendScanRecord(record: StoredScanRecord): StoredScanRecord[] {
  const existing = ensureLoaded();
  const next = [record, ...existing].slice(0, MAX_STORED_SCANS);
  memoryScans = next;
  persistToDisk(next);
  return next;
}

export function listScanRecords(filters?: {
  stream?: string;
  query?: string;
}): StoredScanRecord[] {
  const scans = ensureLoaded();
  const stream = filters?.stream?.trim();
  const q = filters?.query?.trim().toLowerCase();

  return scans.filter((entry) => {
    if (stream === 'Recyclable' || stream === 'Non-Recyclable') {
      if (entry.result.primaryCategory !== stream) return false;
    }
    if (!q) return true;
    return (
      entry.result.itemDetected.toLowerCase().includes(q) ||
      entry.result.aiCategories.materialDna.code.toLowerCase().includes(q) ||
      entry.result.aiCategories.contaminationRisk.level.toLowerCase().includes(q)
    );
  });
}

export function deleteScanRecord(id: string): boolean {
  const existing = ensureLoaded();
  const next = existing.filter((s) => s.id !== id);
  if (next.length === existing.length) return false;
  memoryScans = next;
  persistToDisk(next);
  return true;
}

export function clearScanRecords(): void {
  memoryScans = [];
  persistToDisk([]);
}

export function computeServerStats(scans = ensureLoaded()): ServerAnalyticsStats {
  const totalScans = scans.length;
  if (totalScans === 0) {
    return {
      totalScans: 0,
      recyclableCount: 0,
      nonRecyclableCount: 0,
      diversionRate: 0,
      avgCircularity: 0,
      cleanReadyRate: 0,
      estimatedCo2SavedKg: 0,
      avgLatencyMs: 0,
      topMaterials: [],
    };
  }

  let recyclableCount = 0;
  let cleanReadyCount = 0;
  let circularitySum = 0;
  let co2Sum = 0;
  let latencySum = 0;
  const materialCounts = new Map<string, number>();

  for (const s of scans) {
    if (s.result.primaryCategory === 'Recyclable') recyclableCount += 1;
    if (s.result.aiCategories.contaminationRisk.level === 'Clean Ready') cleanReadyCount += 1;
    circularitySum += s.result.aiCategories.circularityPotential.score;
    co2Sum += s.estimatedCo2SavedKg ?? 0;
    latencySum += s.latencyMs ?? 0;

    const code = (s.result.aiCategories.materialDna.code || 'UNKNOWN').trim().toUpperCase();
    materialCounts.set(code, (materialCounts.get(code) ?? 0) + 1);
  }

  const nonRecyclableCount = totalScans - recyclableCount;
  const topMaterials = Array.from(materialCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  return {
    totalScans,
    recyclableCount,
    nonRecyclableCount,
    diversionRate: Math.round((recyclableCount / totalScans) * 100),
    avgCircularity: Math.round(circularitySum / totalScans),
    cleanReadyRate: Math.round((cleanReadyCount / totalScans) * 100),
    estimatedCo2SavedKg: Number(co2Sum.toFixed(2)),
    avgLatencyMs: Math.round(latencySum / totalScans),
    topMaterials,
  };
}

function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildServerCsvExport(scans = ensureLoaded()): string {
  const headers = [
    'Scan ID',
    'Timestamp',
    'Item Detected',
    'Primary Category',
    'Confidence (%)',
    'Circularity Score',
    'Circularity Tier',
    'Contamination Risk',
    'Material DNA',
    'Sorting Rule Profile',
    'Est. CO2e Saved (kg)',
    'Model Used',
    'Disposal Action',
  ];

  const rows = scans.map((entry) => [
    entry.id,
    new Date(entry.timestamp).toISOString(),
    entry.result.itemDetected,
    entry.result.primaryCategory,
    entry.result.confidenceScore,
    entry.result.aiCategories.circularityPotential.score,
    entry.result.aiCategories.circularityPotential.tier,
    entry.result.aiCategories.contaminationRisk.level,
    entry.result.aiCategories.materialDna.code,
    entry.sortingProfile,
    entry.estimatedCo2SavedKg.toFixed(2),
    entry.modelUsed,
    entry.result.disposalAction,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}
