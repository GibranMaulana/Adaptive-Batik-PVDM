import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { base64ToPngDataUrl } from '../../api/client';

export interface PixelRasterCanvasHandle {
  setProgress: (progress: number, showCursor?: boolean) => void;
}

interface PixelRasterCanvasProps {
  coverImageUrl: string;
  stegoBase64: string | null;
  width?: number;
  height?: number;
  progress?: number;
  showCursor?: boolean;
  coverBackdropOpacity?: number;
  rowScanlineOnly?: boolean;
  initialProgress?: number;
  initialShowCursor?: boolean;
  alt?: string;
  className?: string;
  ref?: Ref<PixelRasterCanvasHandle>;
}

function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function PixelRasterCanvas({
  coverImageUrl,
  stegoBase64,
  width = 512,
  height = 512,
  progress,
  showCursor,
  coverBackdropOpacity = 0.15,
  rowScanlineOnly = false,
  initialProgress = 0,
  initialShowCursor = true,
  alt = 'Stego raster output',
  className = '',
  ref,
}: PixelRasterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const progressRef = useRef<number>(progress ?? initialProgress);
  const showCursorRef = useRef<boolean>(showCursor ?? initialShowCursor);
  const hasStegoRef = useRef<boolean>(Boolean(stegoBase64));

  const drawAtProgress = useCallback(
    (nextProgress: number, nextShowCursor = true) => {
      const clamped = Math.max(0, Math.min(1, nextProgress));
      progressRef.current = clamped;
      showCursorRef.current = nextShowCursor;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      const ghostCanvas = ghostCanvasRef.current;
      const activeCanvas = activeCanvasRef.current ?? coverCanvasRef.current;

      if (clamped >= 1 && activeCanvas) {
        ctx.drawImage(activeCanvas, 0, 0, width, height);
        return;
      }

      if (ghostCanvas) {
        ctx.drawImage(ghostCanvas, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#F6F4EF';
        ctx.fillRect(0, 0, width, height);
      }

      if (!activeCanvas || clamped <= 0) {
        return;
      }

      const totalPixels = width * height;
      const pixelCount = Math.round(clamped * totalPixels);
      const fullRows = Math.floor(pixelCount / width);
      const activeCol = pixelCount % width;

      if (fullRows > 0) {
        const clampedRows = Math.min(height, fullRows);
        ctx.drawImage(activeCanvas, 0, 0, width, clampedRows, 0, 0, width, clampedRows);
      }

      if (fullRows < height && activeCol > 0) {
        ctx.drawImage(activeCanvas, 0, fullRows, activeCol, 1, 0, fullRows, activeCol, 1);
      }

      if (!nextShowCursor) {
        return;
      }

      if (rowScanlineOnly) {
        if (fullRows <= 0 || fullRows > height) return;
        const scanRow = activeCol > 0 ? Math.min(height - 1, fullRows) : Math.max(0, fullRows - 1);

        ctx.save();
        // Soft sogan-gold glow halo around the active raster row
        ctx.fillStyle = 'rgba(154, 107, 47, 0.22)';
        ctx.fillRect(0, Math.max(0, scanRow - 2), width, 5);

        // Crisp sogan-gold active row scanline
        ctx.fillStyle = '#9A6B2F';
        ctx.fillRect(0, scanRow, width, 2);

        // Subtle ivory sheen right above the active scanline
        if (scanRow > 0) {
          ctx.fillStyle = 'rgba(253, 252, 249, 0.55)';
          ctx.fillRect(0, scanRow - 1, width, 1);
        }
        ctx.restore();
        return;
      }

      if (fullRows < height) {
        ctx.save();

        // Subtle horizontal scanline guide on the active raster row
        ctx.fillStyle = 'rgba(154, 107, 47, 0.2)';
        ctx.fillRect(0, Math.max(0, fullRows - 1), width, 2);

        // Soft leading-edge shimmer across the last few newly written pixels
        const hasPartial = activeCol > 0;
        const trailEndX = hasPartial ? activeCol : width;
        const trailRow = hasPartial ? fullRows : Math.max(0, fullRows - 1);
        const trailWidth = Math.min(56, trailEndX);
        const trailStartX = Math.max(0, trailEndX - trailWidth);

        if (trailEndX > trailStartX) {
          const grad = ctx.createLinearGradient(trailStartX, trailRow, trailEndX, trailRow);
          grad.addColorStop(0, 'rgba(154, 107, 47, 0)');
          grad.addColorStop(0.55, 'rgba(253, 252, 249, 0.6)');
          grad.addColorStop(1, 'rgba(154, 107, 47, 0.92)');
          ctx.fillStyle = grad;
          ctx.fillRect(trailStartX, Math.max(0, trailRow - 2), trailEndX - trailStartX, 5);
        }

        // Crisp glowing sogan-gold write-head pixel cursor (#9A6B2F) at (activeCol, fullRows)
        const glow = ctx.createRadialGradient(activeCol, fullRows, 0, activeCol, fullRows, 14);
        glow.addColorStop(0, 'rgba(154, 107, 47, 0.85)');
        glow.addColorStop(0.35, 'rgba(154, 107, 47, 0.35)');
        glow.addColorStop(1, 'rgba(154, 107, 47, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(activeCol, fullRows, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9A6B2F';
        ctx.fillRect(activeCol - 3, fullRows - 3, 6, 6);
        ctx.fillStyle = '#FDFCF9';
        ctx.fillRect(activeCol - 1, fullRows - 1, 2, 2);

        ctx.restore();
      }
    },
    [height, rowScanlineOnly, width],
  );

  useImperativeHandle(
    ref,
    () => ({
      setProgress: (nextProgress: number, nextShowCursor = true) => {
        drawAtProgress(nextProgress, nextShowCursor);
      },
    }),
    [drawAtProgress],
  );

  // Sync declarative progress/showCursor props when provided
  useEffect(() => {
    if (progress === undefined && showCursor === undefined) return;
    drawAtProgress(
      progress ?? progressRef.current,
      showCursor ?? showCursorRef.current,
    );
  }, [drawAtProgress, progress, showCursor]);

  // Decode cover image into backdrop ghost canvas + fallback active buffer
  useEffect(() => {
    let cancelled = false;
    ghostCanvasRef.current = null;
    coverCanvasRef.current = null;

    if (!coverImageUrl) {
      drawAtProgress(progressRef.current, showCursorRef.current);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;

      const ghost = createOffscreenCanvas(width, height);
      const gCtx = ghost.getContext('2d');
      if (gCtx) {
        gCtx.imageSmoothingEnabled = false;
        gCtx.fillStyle = '#FDFCF9';
        gCtx.fillRect(0, 0, width, height);
        gCtx.globalAlpha = coverBackdropOpacity;
        gCtx.drawImage(img, 0, 0, width, height);
        gCtx.globalAlpha = 1;
        ghostCanvasRef.current = ghost;
      }

      const coverFull = createOffscreenCanvas(width, height);
      const cCtx = coverFull.getContext('2d');
      if (cCtx) {
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(img, 0, 0, width, height);
        coverCanvasRef.current = coverFull;
      }

      if (!hasStegoRef.current && !activeCanvasRef.current) {
        activeCanvasRef.current = coverFull;
      }

      drawAtProgress(progressRef.current, showCursorRef.current);
    };
    img.src = coverImageUrl;

    return () => {
      cancelled = true;
    };
  }, [coverBackdropOpacity, coverImageUrl, drawAtProgress, height, width]);

  // Decode lossless stego PNG into offscreen canvas
  useEffect(() => {
    let cancelled = false;
    hasStegoRef.current = Boolean(stegoBase64);

    if (!stegoBase64) {
      activeCanvasRef.current = coverCanvasRef.current;
      drawAtProgress(progressRef.current, showCursorRef.current);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const stegoCanvas = createOffscreenCanvas(width, height);
      const sCtx = stegoCanvas.getContext('2d');
      if (sCtx) {
        sCtx.imageSmoothingEnabled = false;
        sCtx.drawImage(img, 0, 0, width, height);
        // Materialize ImageData once to guarantee decoded raster readiness
        sCtx.getImageData(0, 0, width, height);
        activeCanvasRef.current = stegoCanvas;
      }
      drawAtProgress(progressRef.current, showCursorRef.current);
    };
    img.src = base64ToPngDataUrl(stegoBase64);

    return () => {
      cancelled = true;
    };
  }, [drawAtProgress, height, stegoBase64, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      role="img"
      aria-label={alt}
      className={`block h-full max-h-full w-full max-w-full object-contain ${className}`}
    />
  );
}
