import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { WasteClassificationResult } from '../src/types/waste.ts';
import { SERVER_SORTING_PROFILES } from './materialsData.ts';

export class GeminiServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'GEMINI_ERROR') {
    super(message);
    this.name = 'GeminiServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ClassificationMeta {
  cached: boolean;
  latencyMs: number;
  modelUsed: string;
  estimatedCo2SavedKg: number;
}

const SYSTEM_INSTRUCTION = `You are SmartBin, an expert materials recovery engineer and waste-sorting vision analyst.
Your job is to inspect an image of waste or discarded consumer items and classify the primary item into exactly one of two primary buckets: "Recyclable" or "Non-Recyclable", along with structured analytical categories.

Rules for accurate sorting:
1. "Recyclable" applies to clean or lightly rinsable mono-materials widely accepted in standard curbside or municipal streams (e.g., PET #1 bottles, HDPE #2 jugs, clean corrugated cardboard, aluminum beverage cans, tin/steel cans, clean glass bottles/jars).
2. "Non-Recyclable" applies to:
   - Food- or grease-soaked paper/cardboard (e.g., oil-stained pizza box bases),
   - Plastic-lined or wax-coated paper cups (standard takeaway coffee cups),
   - Multi-layer foil pouches, chip bags, blister packs, styrofoam/EPS,
   - E-waste, batteries, ceramics, broken window glass, or hazardous items that cannot go into standard recycling bins (even if specialized take-back exists—explain that in disposalAction).
3. If multiple items are visible, focus on the dominant primary object in the foreground and note secondary components in sortingConfidenceNote.
4. Keep "reason" to 1 clear, factual sentence.
5. Keep "disposalAction" practical, imperative, and concise (1 sentence).
6. For "materialDna.code", provide a crisp uppercase industrial code like "PET #1", "HDPE #2", "ALUMINUM 41", "GREASE-SOAKED OCC", "PE-LINED PAPERBOARD", "MULTI-LAYER FOIL", "COMPOSITE E-WASTE", etc.
7. For "secondLifeArchetype", propose an imaginative yet safe creative reuse or upcycling concept when safe; if unsafe/contaminated/toxic, set isRepurposable to false and explain why it should not be repurposed at home.
8. For "sortingConfidenceNote", call out any visual edge cases (coatings, hidden linings, printed inks, glare, crushed geometry, or municipal rule variance).
9. Set "noWasteDetected" to true ONLY if the image shows a camera-disabled placeholder, crossed-out camera icon, covered/blank screen, or contains no recognizable waste or consumer object at all; otherwise set "noWasteDetected" to false.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    noWasteDetected: {
      type: Type.BOOLEAN,
      description:
        'True if the image is a camera-disabled placeholder, blank/black frame, or contains no recognizable waste or consumer object.',
    },
    primaryCategory: {
      type: Type.STRING,
      enum: ['Recyclable', 'Non-Recyclable'],
      description: 'Primary sorting bucket for the detected waste item.',
    },
    confidenceScore: {
      type: Type.NUMBER,
      description: 'Model confidence percentage from 0 to 100.',
    },
    reason: {
      type: Type.STRING,
      description: 'One concise sentence explaining why the item belongs in this bucket.',
    },
    itemDetected: {
      type: Type.STRING,
      description: 'Clear name of the primary waste object(s) visible.',
    },
    disposalAction: {
      type: Type.STRING,
      description: 'Short, practical handling tip before disposal or collection.',
    },
    aiCategories: {
      type: Type.OBJECT,
      properties: {
        circularityPotential: {
          type: Type.OBJECT,
          properties: {
            tier: {
              type: Type.STRING,
              enum: ['High Loop', 'Downcycle Path', 'Linear / Landfill'],
              description: 'Circularity loop classification.',
            },
            score: {
              type: Type.NUMBER,
              description: 'Circularity score from 0 to 100.',
            },
            explanation: {
              type: Type.STRING,
              description: 'Brief explanation of how easily the material re-enters a loop.',
            },
          },
          required: ['tier', 'score', 'explanation'],
        },
        contaminationRisk: {
          type: Type.OBJECT,
          properties: {
            level: {
              type: Type.STRING,
              enum: ['Clean Ready', 'Needs Rinse', 'High Contamination'],
              description: 'Contamination severity status.',
            },
            detail: {
              type: Type.STRING,
              description:
                'Specific contamination factor such as grease, liquid residue, coatings, or sharp/toxic parts.',
            },
          },
          required: ['level', 'detail'],
        },
        materialDna: {
          type: Type.OBJECT,
          properties: {
            code: {
              type: Type.STRING,
              description:
                'Short technical material/resin code tag (e.g., PET #1, ALUMINUM 41, MULTI-LAYER FOIL).',
            },
            composition: {
              type: Type.STRING,
              description: 'Concise breakdown of underlying polymers, fibers, metals, or composite layers.',
            },
          },
          required: ['code', 'composition'],
        },
        secondLifeArchetype: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Creative archetype title or safety boundary title.',
            },
            idea: {
              type: Type.STRING,
              description:
                'Imaginative upcycling/alternative use concept, or why it cannot be safely repurposed.',
            },
            isRepurposable: {
              type: Type.BOOLEAN,
              description: 'Whether the item can be safely upcycled or repurposed.',
            },
          },
          required: ['title', 'idea', 'isRepurposable'],
        },
        sortingConfidenceNote: {
          type: Type.OBJECT,
          properties: {
            certaintyLabel: {
              type: Type.STRING,
              enum: ['High Certainty', 'Moderate Certainty', 'Ambiguous Edge Case'],
              description: 'Certainty tier for visual identification.',
            },
            ambiguityNote: {
              type: Type.STRING,
              description:
                'Edge-case caveats such as coated cups, printed inks, hidden linings, or partial views.',
            },
          },
          required: ['certaintyLabel', 'ambiguityNote'],
        },
      },
      required: [
        'circularityPotential',
        'contaminationRisk',
        'materialDna',
        'secondLifeArchetype',
        'sortingConfidenceNote',
      ],
    },
  },
  required: [
    'noWasteDetected',
    'primaryCategory',
    'confidenceScore',
    'reason',
    'itemDetected',
    'disposalAction',
    'aiCategories',
  ],
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is missing or unconfigured. Please set your API key in Settings > Secrets.',
      500,
      'API_KEY_MISSING'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const MAX_CACHE_ENTRIES = 100;

interface CachedClassification {
  result: WasteClassificationResult;
  modelUsed: string;
  estimatedCo2SavedKg: number;
}

const responseCache = new Map<string, CachedClassification>();

export function getCacheSize(): number {
  return responseCache.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHighDemandError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    message.includes('503') ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('overloaded')
  );
}

export function estimateCo2SavedKg(result: WasteClassificationResult): number {
  if (result.noWasteDetected || result.primaryCategory !== 'Recyclable') {
    return 0;
  }

  const code = result.aiCategories.materialDna.code.toUpperCase();
  if (code.includes('ALU') || code.includes('TIN') || code.includes('STEEL')) {
    return 0.18;
  }
  if (code.includes('GLASS')) {
    return 0.12;
  }
  if (code.includes('PET') || code.includes('HDPE') || code.includes('PP')) {
    return 0.09;
  }
  if (code.includes('PAP') || code.includes('OCC') || code.includes('CARDBOARD')) {
    return 0.07;
  }
  return 0.06;
}

export async function classifyWasteImageWithMeta(
  imageBase64: string,
  mimeType: string,
  sortingProfile = 'standard'
): Promise<{ result: WasteClassificationResult; meta: ClassificationMeta }> {
  const startMs = Date.now();

  // Compute SHA-256 hash key of (imageBase64 + sortingProfile) for deduplication cache
  const cacheKey = crypto
    .createHash('sha256')
    .update(`${sortingProfile}:${imageBase64}`)
    .digest('hex');

  const cached = responseCache.get(cacheKey);
  if (cached) {
    return {
      result: cached.result,
      meta: {
        cached: true,
        latencyMs: Math.max(1, Date.now() - startMs),
        modelUsed: cached.modelUsed,
        estimatedCo2SavedKg: cached.estimatedCo2SavedKg,
      },
    };
  }

  const ai = getAiClient();
  const matchedProfile =
    SERVER_SORTING_PROFILES.find((p) => p.id === sortingProfile) ?? SERVER_SORTING_PROFILES[0];

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const model = modelsToTry[attempt];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `Analyze this waste image and return the structured JSON classification according to the schema.\n${matchedProfile.promptRule}`,
            },
          ],
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          abortSignal: AbortSignal.timeout(model === PRIMARY_MODEL ? 9000 : 18000),
          ...(model === PRIMARY_MODEL
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new GeminiServiceError(
          'Gemini returned an empty response for this image. Please try another photo with clearer lighting.',
          502,
          'EMPTY_MODEL_RESPONSE'
        );
      }

      const parsed = JSON.parse(rawText) as WasteClassificationResult;

      // Normalize numeric bounds safely
      parsed.confidenceScore = Math.max(0, Math.min(100, Math.round(parsed.confidenceScore)));
      parsed.aiCategories.circularityPotential.score = Math.max(
        0,
        Math.min(100, Math.round(parsed.aiCategories.circularityPotential.score))
      );

      const estimatedCo2SavedKg = estimateCo2SavedKg(parsed);
      const latencyMs = Math.max(1, Date.now() - startMs);

      // Evict oldest entry if cache reaches capacity
      if (responseCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
      }
      responseCache.set(cacheKey, {
        result: parsed,
        modelUsed: model,
        estimatedCo2SavedKg,
      });

      return {
        result: parsed,
        meta: {
          cached: false,
          latencyMs,
          modelUsed: model,
          estimatedCo2SavedKg,
        },
      };
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[SmartBin Gemini] attempt ${attempt + 1} (${model}) failed:`, errMsg);

      if (err instanceof GeminiServiceError) {
        throw err;
      }
      const lowerErr = errMsg.toLowerCase();
      const isTimeoutOrTransient =
        isTransientHighDemandError(err) ||
        lowerErr.includes('429') ||
        lowerErr.includes('resource_exhausted') ||
        lowerErr.includes('quota') ||
        lowerErr.includes('abort') ||
        lowerErr.includes('timeout');

      if (isTimeoutOrTransient && attempt < modelsToTry.length - 1) {
        await sleep(500);
        continue;
      }
      break;
    }
  }

  const err = lastError;
  const message = err instanceof Error ? err.message : 'Unexpected error calling Gemini API.';
  const lower = message.toLowerCase();

  if (isTransientHighDemandError(err)) {
    throw new GeminiServiceError(
      'The Gemini vision model is experiencing temporary high demand. Please retry in a few seconds.',
      503,
      'MODEL_UNAVAILABLE'
    );
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    throw new GeminiServiceError(
      'The configured Gemini model was not found or is unavailable. Please try again shortly.',
      404,
      'MODEL_NOT_FOUND'
    );
  }
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('400')) {
    throw new GeminiServiceError(
      'The configured GEMINI_API_KEY appears invalid. Please verify your API key in Settings > Secrets.',
      400,
      'API_KEY_INVALID'
    );
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    throw new GeminiServiceError(
      'Permission denied by Gemini API. Check your API key permissions in Settings > Secrets.',
      403,
      'PERMISSION_DENIED'
    );
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    throw new GeminiServiceError(
      'Gemini API rate limit or quota exceeded. Please wait a moment and try again.',
      429,
      'RESOURCE_EXHAUSTED'
    );
  }
  if (err instanceof SyntaxError) {
    throw new GeminiServiceError(
      'Unable to parse structured classification JSON from model output. Please retry.',
      502,
      'INVALID_JSON_RESPONSE'
    );
  }

  throw new GeminiServiceError(message, 500, 'GEMINI_REQUEST_FAILED');
}

export async function classifyWasteImage(
  imageBase64: string,
  mimeType: string,
  sortingProfile = 'standard'
): Promise<WasteClassificationResult> {
  const { result } = await classifyWasteImageWithMeta(imageBase64, mimeType, sortingProfile);
  return result;
}
