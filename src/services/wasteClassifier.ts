import type {
  MaterialReferenceEntry,
  ServerAnalyticsStats,
  SortingProfileId,
  WasteClassificationResult,
} from '../types/waste';

export class ClassifierClientError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'CLASSIFY_ERROR', status = 500) {
    super(message);
    this.name = 'ClassifierClientError';
    this.code = code;
    this.status = status;
  }
}

export interface PreparedImage {
  previewUrl: string;
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface ServerScanRecord {
  id: string;
  timestamp: number;
  sortingProfile: SortingProfileId;
  modelUsed: string;
  latencyMs: number;
  cached: boolean;
  estimatedCo2SavedKg: number;
  result: WasteClassificationResult;
}

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i;
const MAX_DIMENSION = 1024;

function normalizeMime(mime: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export async function prepareFileForClassification(file: File): Promise<PreparedImage> {
  const isImageMime =
    SUPPORTED_MIMES.has(file.type.toLowerCase()) ||
    file.type.toLowerCase().startsWith('image/') ||
    (file.type === '' && IMAGE_EXT_REGEX.test(file.name));

  if (!isImageMime) {
    throw new ClassifierClientError(
      'Unsupported file format. Please upload a JPG, PNG, or WEBP image.',
      'UNSUPPORTED_FILE',
      400
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await downscaleImageUrl(objectUrl, normalizeMime(file.type));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareUrlForClassification(imageUrl: string): Promise<PreparedImage> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new ClassifierClientError(
      'Could not load the selected sample image.',
      'PRESET_LOAD_ERROR',
      response.status
    );
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await downscaleImageUrl(objectUrl, normalizeMime(blob.type || 'image/jpeg'));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function downscaleImageUrl(
  srcUrl: string,
  targetMime: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;
      if (width === 0 || height === 0) {
        reject(
          new ClassifierClientError('The selected image has invalid dimensions.', 'INVALID_IMAGE', 400)
        );
        return;
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new ClassifierClientError('Unable to initialize image canvas.', 'CANVAS_ERROR', 500));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const quality = targetMime === 'image/png' ? undefined : 0.9;
      const dataUrl = canvas.toDataURL(targetMime, quality);
      const base64 = dataUrl.split(',')[1] ?? '';

      if (!base64) {
        reject(new ClassifierClientError('Failed to encode image data.', 'ENCODE_ERROR', 500));
        return;
      }

      resolve({
        previewUrl: dataUrl,
        base64,
        mimeType: targetMime,
      });
    };

    img.onerror = () => {
      reject(
        new ClassifierClientError(
          'Failed to decode image. Please try a different JPG, PNG, or WEBP file.',
          'IMAGE_DECODE_ERROR',
          400
        )
      );
    };

    img.src = srcUrl;
  });
}

export async function classifyWasteImage(
  imageBase64: string,
  mimeType: string,
  sortingProfile = 'standard'
): Promise<WasteClassificationResult> {
  let response: Response;
  try {
    response = await fetch('/api/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64, mimeType, sortingProfile }),
    });
  } catch {
    throw new ClassifierClientError(
      'Network error contacting SmartBin classification server. Please check your connection and retry.',
      'NETWORK_ERROR',
      0
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ClassifierClientError(
      `Server returned an unreadable response (HTTP ${response.status}).`,
      'BAD_SERVER_RESPONSE',
      response.status
    );
  }

  if (!response.ok) {
    const errObj = payload as { error?: string; code?: string };
    throw new ClassifierClientError(
      errObj?.error || `Classification failed (HTTP ${response.status}).`,
      errObj?.code || 'CLASSIFY_FAILED',
      response.status
    );
  }

  return payload as WasteClassificationResult;
}

export async function fetchServerScans(): Promise<{
  scans: ServerScanRecord[];
  stats: ServerAnalyticsStats;
} | null> {
  try {
    const res = await fetch('/api/scans');
    if (!res.ok) return null;
    return (await res.json()) as {
      scans: ServerScanRecord[];
      stats: ServerAnalyticsStats;
    };
  } catch {
    return null;
  }
}

export async function deleteServerScan(id: string): Promise<ServerAnalyticsStats | null> {
  try {
    const res = await fetch(`/api/scans/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return null;
    const data = (await res.json()) as { stats?: ServerAnalyticsStats };
    return data.stats ?? null;
  } catch {
    return null;
  }
}

export async function clearServerScans(): Promise<ServerAnalyticsStats | null> {
  try {
    const res = await fetch('/api/scans', { method: 'DELETE' });
    if (!res.ok) return null;
    const data = (await res.json()) as { stats?: ServerAnalyticsStats };
    return data.stats ?? null;
  } catch {
    return null;
  }
}

export async function fetchMaterialsDirectory(
  query: string,
  stream: string
): Promise<MaterialReferenceEntry[] | null> {
  try {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (stream && stream !== 'All') params.set('stream', stream);
    const res = await fetch(`/api/materials?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { materials?: MaterialReferenceEntry[] };
    return Array.isArray(data.materials) ? data.materials : null;
  } catch {
    return null;
  }
}
