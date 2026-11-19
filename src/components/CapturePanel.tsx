import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Radio,
  RefreshCw,
  SwitchCamera,
  Upload,
  X,
  AlertCircle,
  ExternalLink,
  ZoomIn,
} from 'lucide-react';
import { CAPTURE_TIPS, SAMPLE_PRESETS } from '../data/presets';
import type { SamplePreset } from '../types/waste';

export type InputMode = 'upload' | 'camera';

interface CapturePanelProps {
  inputMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  activeImageSrc: string | null;
  activePresetId: string | null;
  isAnalyzing: boolean;
  batchProgress?: { current: number; total: number; fileName: string } | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  nativeCameraInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (file: File) => void;
  onBatchFilesSelected?: (files: File[]) => void;
  onCameraCaptured: (dataUrl: string, options?: { keepCameraOpen?: boolean }) => void;
  onPresetSelected: (preset: SamplePreset) => void;
  onClearImage: () => void;
  onReanalyze: () => void;
}

export const CapturePanel: React.FC<CapturePanelProps> = ({
  inputMode,
  onModeChange,
  activeImageSrc,
  activePresetId,
  isAnalyzing,
  batchProgress,
  fileInputRef,
  nativeCameraInputRef,
  onFileSelected,
  onBatchFilesSelected,
  onCameraCaptured,
  onPresetSelected,
  onClearImage,
  onReanalyze,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [presetImageErrors, setPresetImageErrors] = useState<Record<string, boolean>>({});

  // Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [cameraRetryTick, setCameraRetryTick] = useState(0);
  const [autoDetect, setAutoDetect] = useState(false);

  const isAnalyzingRef = useRef(isAnalyzing);
  isAnalyzingRef.current = isAnalyzing;

  const isCameraReadyRef = useRef(isCameraReady);
  isCameraReadyRef.current = isCameraReady;

  useEffect(() => {
    setImageLoadError(false);
    setIsZoomOpen(false);
  }, [activeImageSrc]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const syncCameraReady = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setIsCameraReady(true);
    }
  }, []);

  useEffect(() => {
    if (inputMode !== 'camera') {
      setAutoDetect(false);
      stopCameraStream();
      return;
    }

    let cancelled = false;

    const initCamera = async () => {
      stopCameraStream();
      setCameraError(null);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Live browser webcam streaming is unavailable in this environment. Use your device camera app or upload a photo.'
        );
        return;
      }

      setIsStartingCamera(true);

      const acquireStream = async (): Promise<MediaStream> => {
        const primaryConstraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };

        try {
          return await navigator.mediaDevices.getUserMedia(primaryConstraints);
        } catch (primaryErr: unknown) {
          const errName = primaryErr instanceof DOMException ? primaryErr.name : '';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            throw primaryErr;
          }
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      };

      try {
        const stream = await acquireStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const currentTrackDeviceId = stream.getVideoTracks()[0]?.getSettings()?.deviceId ?? '';
        setActiveDeviceId(currentTrackDeviceId);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Autoplay with muted+playsInline may resolve asynchronously
          }
          syncCameraReady();
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
          }
        } catch {
          // Ignore enumeration errors
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const errName = err instanceof DOMException ? err.name : '';
        const errMsg = err instanceof Error ? err.message.toLowerCase() : '';

        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errMsg.includes('permission')
        ) {
          setCameraError(
            'Camera access was blocked or denied. Grant camera permission for this site, or use Device Camera / Upload Photo below.'
          );
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setCameraError(
            'Your camera appears to be in use by another application or browser tab. Close the other camera feed and retry.'
          );
        } else {
          setCameraError(
            'No live webcam feed could be started on this device. Use Device Camera App or Upload Photo instead.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsStartingCamera(false);
        }
      }
    };

    void initCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [inputMode, facingMode, selectedDeviceId, cameraRetryTick, stopCameraStream, syncCameraReady]);

  const grabVideoFrameDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  const handleCaptureFrame = () => {
    const dataUrl = grabVideoFrameDataUrl();
    if (!dataUrl) {
      setCameraError(
        'Camera video frame is not ready yet. Wait a moment for the live preview to appear, then try capturing again.'
      );
      return;
    }

    setAutoDetect(false);
    stopCameraStream();
    onModeChange('upload');
    onCameraCaptured(dataUrl, { keepCameraOpen: false });
  };

  useEffect(() => {
    if (inputMode !== 'camera' || !autoDetect || cameraError) return;

    const triggerLiveFrame = () => {
      if (!isCameraReadyRef.current || isAnalyzingRef.current) return;
      const dataUrl = grabVideoFrameDataUrl();
      if (dataUrl) {
        onCameraCaptured(dataUrl, { keepCameraOpen: true });
      }
    };

    const initialTimer = window.setTimeout(triggerLiveFrame, 400);
    const intervalId = window.setInterval(triggerLiveFrame, 5000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
    };
  }, [inputMode, autoDetect, cameraError, grabVideoFrameDataUrl, onCameraCaptured]);

  const handleFlipCamera = () => {
    if (videoDevices.length > 1) {
      const currentIdx = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextDevice = videoDevices[(currentIdx + 1) % videoDevices.length];
      setSelectedDeviceId(nextDevice.deviceId);
    } else {
      setSelectedDeviceId(null);
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 1 && onBatchFilesSelected) {
      onBatchFilesSelected(files);
    } else if (files[0]) {
      onFileSelected(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 1 && onBatchFilesSelected) {
      onBatchFilesSelected(files);
    } else if (files[0]) {
      onFileSelected(files[0]);
    }
    e.target.value = '';
  };

  return (
    <section aria-label="Waste image input and presets" className="flex flex-col gap-6">
      {/* Main Capture Card */}
      <div className="rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]">
        {/* Mode Switcher */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Image input method"
            className="inline-flex rounded-lg bg-sky-50/90 p-1 dark:bg-slate-800/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'upload'}
              onClick={() => onModeChange('upload')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'upload'
                  ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'camera'}
              onClick={() => onModeChange('camera')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'camera'
                  ? 'bg-white text-sky-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-sky-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Live Camera</span>
            </button>
          </div>

          {activeImageSrc && inputMode === 'upload' && (
            <button
              type="button"
              onClick={onClearImage}
              disabled={isAnalyzing}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-sky-50 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/*"
          onChange={handleFileInputChange}
          className="sr-only"
          aria-label="Choose one or more waste image files"
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="sr-only"
          aria-label="Capture photo using native device camera"
        />

        {batchProgress && (
          <div className="mb-3.5 rounded-lg border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-sky-900 dark:text-sky-200">
              <span className="truncate">Batch Scan: {batchProgress.fileName}</span>
              <span className="font-mono shrink-0">
                {batchProgress.current} / {batchProgress.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900">
              <div
                className="h-full bg-sky-600 transition-all duration-300 dark:bg-sky-400"
                style={{
                  width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {inputMode === 'upload' ? (
          activeImageSrc ? (
            <div className="flex flex-col gap-3.5">
              <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-sky-200/80 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                {!imageLoadError ? (
                  <>
                    <img
                      src={activeImageSrc}
                      alt="Selected waste item for SmartBin analysis"
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadError(true)}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setIsZoomOpen(true)}
                      aria-label="Inspect full-size waste image"
                      className="absolute bottom-2.5 right-2.5 inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-sky-200/90 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 cursor-pointer"
                    >
                      <ZoomIn className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                      <span>Inspect</span>
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sky-50 to-slate-100 p-6 text-center dark:from-slate-800 dark:to-slate-900">
                    <ImageIcon className="h-8 w-8 text-slate-400" aria-hidden="true" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Preview unavailable
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>Replace Image</span>
                </button>

                <button
                  type="button"
                  onClick={onReanalyze}
                  disabled={isAnalyzing}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Drop waste image here or click to browse JPG, PNG, or WEBP files"
              className={`flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                isDragging
                  ? 'border-sky-500 bg-sky-50/80 dark:border-sky-400 dark:bg-sky-950/30'
                  : 'border-sky-200 bg-sky-50/40 hover:border-sky-500 hover:bg-sky-50/70 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-sky-500'
              }`}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Drop waste photo(s) here
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Click to browse, batch-drop, or paste with Ctrl+V
              </p>
              <p className="mt-3 font-mono text-xs text-sky-700/75 dark:text-slate-500">
                JPG · PNG · WEBP
              </p>
            </div>
          )
        ) : (
          /* Live Camera Viewfinder */
          <div className="flex flex-col gap-3.5">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-sky-200/80 bg-sky-50/70 dark:border-slate-800 dark:bg-slate-950">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                onLoadedMetadata={syncCameraReady}
                onCanPlay={syncCameraReady}
                onPlaying={syncCameraReady}
                className={`h-full w-full object-cover ${cameraError ? 'hidden' : 'block'}`}
              />

              {cameraError ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center">
                  <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400 shrink-0" aria-hidden="true" />
                  <p className="max-w-xs text-xs leading-relaxed text-slate-700 dark:text-slate-200 sm:text-sm">
                    {cameraError}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraRetryTick((n) => n + 1)}
                      className="min-h-[40px] rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap cursor-pointer"
                    >
                      Retry Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="min-h-[40px] rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-sky-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
                    >
                      Device Camera App
                    </button>
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-sky-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 whitespace-nowrap"
                    >
                      <span>Open Full Tab</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onModeChange('upload')}
                      className="min-h-[40px] rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-sky-50 dark:border-slate-600 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                    >
                      Upload Photo
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(isStartingCamera || !isCameraReady) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-sky-50/90 text-sm font-medium text-slate-700 dark:bg-slate-950/75 dark:text-white">
                      {isStartingCamera ? 'Starting camera...' : 'Waiting for video frame...'}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-6 rounded-lg border border-white/45" />
                  {autoDetect && isCameraReady && (
                    <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-sky-200 bg-white/95 px-2.5 py-1 font-mono text-[11px] font-semibold text-sky-700 dark:border-slate-700 dark:bg-slate-950/80 dark:text-sky-300">
                      {isAnalyzing ? 'Analyzing frame...' : 'Auto-detect active (5s)'}
                    </div>
                  )}
                </>
              )}
            </div>

            {!cameraError && (
              <>
                {videoDevices.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="camera-device-select"
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                    >
                      Camera:
                    </label>
                    <select
                      id="camera-device-select"
                      value={selectedDeviceId ?? activeDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value || null)}
                      className="min-h-[36px] flex-1 truncate rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    disabled={isStartingCamera}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
                    title="Switch camera"
                  >
                    <SwitchCamera className="h-4 w-4" aria-hidden="true" />
                    <span>Flip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoDetect((prev) => !prev)}
                    disabled={!isCameraReady}
                    aria-pressed={autoDetect}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                      autoDetect
                        ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'border-sky-200 bg-white text-slate-700 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Radio className="h-4 w-4" aria-hidden="true" />
                    <span>{autoDetect ? 'Stop Auto' : 'Auto-Detect'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    disabled={!isCameraReady || isAnalyzing}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap cursor-pointer"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    <span>{isAnalyzing ? 'Analyzing...' : 'Capture & Classify'}</span>
                  </button>
                </div>

                <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Camera showing a disabled placeholder?
                  </p>
                  <p className="mt-1">
                    Unblock your webcam privacy shutter or OS camera toggle, or snap directly using
                    your device camera or photo upload:
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Device Camera App</span>
                    </button>
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      <span>Open Full Tab</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Full-Size Inspection Lightbox */}
      {isZoomOpen && activeImageSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-resolution waste image inspection"
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-xl border border-sky-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-[#101B26]"
          >
            <div className="mb-2 flex items-center justify-between gap-4 px-1">
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Close-Up Material Inspection
              </span>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                aria-label="Close inspection preview"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-sky-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <img
              src={activeImageSrc}
              alt="Zoomed waste photo for inspecting resin codes and contamination"
              className="max-h-[75vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* Sample Presets Panel */}
      <div
        id="presets"
        className="rounded-xl border border-sky-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#101B26]"
      >
        <div className="mb-3.5 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Sample Test Presets
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">1-click inspection</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SAMPLE_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            const hasErr = Boolean(presetImageErrors[preset.id]);

            return (
              <button
                key={preset.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => onPresetSelected(preset)}
                className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-60 cursor-pointer ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/25'
                    : 'border-sky-100 bg-sky-50/35 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700'
                }`}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {!hasErr ? (
                    <img
                      src={preset.imageUrl}
                      alt={preset.hint}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setPresetImageErrors((prev) => ({ ...prev, [preset.id]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-sky-100 to-slate-200 p-2 text-center dark:from-slate-800 dark:to-slate-900">
                      <ImageIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {preset.label}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {preset.shortTag}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick-try photography tips */}
        <div className="mt-5 border-t border-sky-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Quick-Try Capture Tips
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {CAPTURE_TIPS.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="font-mono text-[11px] font-medium text-sky-600 dark:text-sky-400">
                  0{index + 1}.
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
