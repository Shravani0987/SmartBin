export type PrimaryCategory = 'Recyclable' | 'Non-Recyclable';

export type CircularityTier = 'High Loop' | 'Downcycle Path' | 'Linear / Landfill';

export type ContaminationLevel = 'Clean Ready' | 'Needs Rinse' | 'High Contamination';

export type CertaintyLevel = 'High Certainty' | 'Moderate Certainty' | 'Ambiguous Edge Case';

export type SortingProfileId = 'standard' | 'strict' | 'compost' | 'deposit';

export interface SortingProfile {
  id: SortingProfileId;
  label: string;
  shortLabel: string;
  description: string;
  promptRule: string;
}

export interface MaterialReferenceEntry {
  id: string;
  code: string;
  name: string;
  stream: 'Recyclable' | 'Contamination Trap' | 'Drop-Off Only';
  circularity: CircularityTier;
  examples: string;
  prepTip: string;
}

export interface WasteAnalysisCategories {
  circularityPotential: {
    tier: CircularityTier;
    score: number;
    explanation: string;
  };
  contaminationRisk: {
    level: ContaminationLevel;
    detail: string;
  };
  materialDna: {
    code: string;
    composition: string;
  };
  secondLifeArchetype: {
    title: string;
    idea: string;
    isRepurposable: boolean;
  };
  sortingConfidenceNote: {
    certaintyLabel: CertaintyLevel;
    ambiguityNote: string;
  };
}

export interface ServerClassificationMeta {
  id: string;
  timestamp: number;
  sortingProfile: SortingProfileId;
  cached: boolean;
  latencyMs: number;
  modelUsed: string;
  estimatedCo2SavedKg: number;
}

export interface ServerAnalyticsStats {
  totalScans: number;
  recyclableCount: number;
  nonRecyclableCount: number;
  diversionRate: number;
  avgCircularity: number;
  cleanReadyRate: number;
  estimatedCo2SavedKg: number;
  avgLatencyMs: number;
  topMaterials: Array<{ code: string; count: number }>;
}

export interface WasteClassificationResult {
  noWasteDetected?: boolean;
  primaryCategory: PrimaryCategory;
  confidenceScore: number;
  reason: string;
  itemDetected: string;
  disposalAction: string;
  aiCategories: WasteAnalysisCategories;
  serverMeta?: ServerClassificationMeta;
}

export interface SamplePreset {
  id: string;
  label: string;
  shortTag: string;
  imageUrl: string;
  hint: string;
}

export interface ScanHistoryItem {
  id: string;
  timestamp: number;
  imageSrc: string;
  sortingProfile?: SortingProfileId;
  estimatedCo2SavedKg?: number;
  latencyMs?: number;
  cached?: boolean;
  result: WasteClassificationResult;
}
