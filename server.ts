import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifyWasteImageWithMeta,
  GeminiServiceError,
  getCacheSize,
} from './server/geminiService.ts';
import { queryMaterialsDirectory, SERVER_SORTING_PROFILES } from './server/materialsData.ts';
import {
  appendScanRecord,
  buildServerCsvExport,
  clearScanRecords,
  computeServerStats,
  deleteScanRecord,
  listScanRecords,
} from './server/scanStore.ts';
import type { SortingProfileId } from './src/types/waste.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VALID_PROFILES = new Set<SortingProfileId>(['standard', 'strict', 'compost', 'deposit']);

// Sliding-window rate limiter for /api/classify (60 requests per minute per IP)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const ipRequestTimestamps = new Map<string, number[]>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (ipRequestTimestamps.get(ip) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    ipRequestTimestamps.set(ip, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  ipRequestTimestamps.set(ip, recent);
  return { allowed: true, retryAfterSec: 0 };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    const stats = computeServerStats();
    res.json({
      status: 'ok',
      service: 'SmartBin',
      storedScans: stats.totalScans,
      cacheEntries: getCacheSize(),
    });
  });

  app.get('/api/rules', (_req, res) => {
    res.json({ profiles: SERVER_SORTING_PROFILES });
  });

  app.get('/api/materials', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const stream = typeof req.query.stream === 'string' ? req.query.stream : 'All';
    const materials = queryMaterialsDirectory(query, stream);
    res.json({ materials, total: materials.length });
  });

  app.get('/api/scans', (req, res) => {
    const stream = typeof req.query.stream === 'string' ? req.query.stream : undefined;
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const scans = listScanRecords({ stream, query });
    const stats = computeServerStats();
    res.json({ scans, stats });
  });

  app.get('/api/scans/export.csv', (_req, res) => {
    const csv = buildServerCsvExport();
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="smartbin-audit-${dateStamp}.csv"`);
    res.send(csv);
  });

  app.delete('/api/scans', (_req, res) => {
    clearScanRecords();
    res.json({ ok: true, stats: computeServerStats() });
  });

  app.delete('/api/scans/:id', (req, res) => {
    const deleted = deleteScanRecord(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Scan record not found.', code: 'SCAN_NOT_FOUND' });
      return;
    }
    res.json({ ok: true, stats: computeServerStats() });
  });

  app.post('/api/classify', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const limitCheck = checkRateLimit(clientIp);
      if (!limitCheck.allowed) {
        res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
        res.status(429).json({
          error: `Rate limit reached. Please wait ${limitCheck.retryAfterSec}s before classifying more images.`,
          code: 'RATE_LIMITED',
        });
        return;
      }

      const { imageBase64, mimeType, sortingProfile } = req.body ?? {};

      if (typeof imageBase64 !== 'string' || imageBase64.trim().length === 0) {
        res.status(400).json({
          error: 'No image data provided. Upload a JPG, PNG, or WEBP image or capture a photo.',
          code: 'MISSING_IMAGE',
        });
        return;
      }

      if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          error: 'Unsupported image format. Please use JPG, PNG, or WEBP.',
          code: 'UNSUPPORTED_MIME_TYPE',
        });
        return;
      }

      const cleanedBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      const profileKey: SortingProfileId =
        typeof sortingProfile === 'string' && VALID_PROFILES.has(sortingProfile as SortingProfileId)
          ? (sortingProfile as SortingProfileId)
          : 'standard';

      const { result, meta } = await classifyWasteImageWithMeta(
        cleanedBase64,
        mimeType,
        profileKey
      );

      const scanId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = Date.now();

      if (!result.noWasteDetected) {
        appendScanRecord({
          id: scanId,
          timestamp,
          sortingProfile: profileKey,
          modelUsed: meta.modelUsed,
          latencyMs: meta.latencyMs,
          cached: meta.cached,
          estimatedCo2SavedKg: meta.estimatedCo2SavedKg,
          result,
        });
      }

      res.json({
        ...result,
        serverMeta: {
          id: scanId,
          timestamp,
          sortingProfile: profileKey,
          cached: meta.cached,
          latencyMs: meta.latencyMs,
          modelUsed: meta.modelUsed,
          estimatedCo2SavedKg: meta.estimatedCo2SavedKg,
        },
      });
    } catch (err: unknown) {
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
        });
        return;
      }

      const message = err instanceof Error ? err.message : 'Classification failed unexpectedly.';
      res.status(500).json({
        error: message,
        code: 'INTERNAL_ERROR',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SmartBin server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SmartBin server:', err);
  process.exit(1);
});
