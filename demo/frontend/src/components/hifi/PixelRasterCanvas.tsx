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
  initialProgress = 0,
  initialShowCursor = true,
  alt = 'Stego raster output',
  className = '',
  ref,
}: PixelRasterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const progressRef = useRef<number>(initialProgress);
  const showCursorRef = useRef<boolean>(initialShowCursor);

  const drawAtProgress = useCallback(
    (progress: number, showCursor = true) => {
      const clamped = Math.max(0, Math.min(1, progress));
      progressRef.current = clamped;
      showCursorRef.current = showCursor;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      const ghostCanvas = ghostCanvasRef.current;
      const activeCanvas = activeCanvasRef.current;

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
      const pixelCount = Math.floor(clamped * totalPixels);
      const fullRows = Math.floor(pixelCount / width);
      const activeCol = pixelCount % width;

      if (fullRows > 0) {
        ctx.drawImage(activeCanvas, 0, 0, width, fullRows, 0, 0, width, fullRows);
      }

      if (fullRows < height && activeCol > 0) {
        ctx.drawImage(activeCanvas, 0, fullRows, activeCol, 1, 0, fullRows, activeCol, 1);
      }

      if (showCursor && fullRows < height) {
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
    [height, width],
  );

  useImperativeHandle(
    ref,
    () => ({
      setProgress: (progress: number, showCursor = true) => {
        drawAtProgress(progress, showCursor);
      },
    }),
    [drawAtProgress],
  );

  // Decode cover image into faint 15% ghost backdrop (and active buffer when no stego PNG exists)
  useEffect(() => {
    let cancelled = false;
    ghostCanvasRef.current = null;
    if (!stegoBase64) {
      activeCanvasRef.current = null;
    }

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
        gCtx.globalAlpha = 0.15;
        gCtx.drawImage(img, 0, 0, width, height);
        gCtx.globalAlpha = 1;
        ghostCanvasRef.current = ghost;
      }

      if (!stegoBase64) {
        const fallbackActive = createOffscreenCanvas(width, height);
        const aCtx = fallbackActive.getContext('2d');
        if (aCtx) {
          aCtx.imageSmoothingEnabled = false;
          aCtx.drawImage(img, 0, 0, width, height);
          activeCanvasRef.current = fallbackActive;
        }
      }

      drawAtProgress(progressRef.current, showCursorRef.current);
    };
    img.src = coverImageUrl;

    return () => {
      cancelled = true;
    };
  }, [coverImageUrl, drawAtProgress, height, stegoBase64, width]);

  // Decode lossless stego PNG into offscreen canvas
  useEffect(() => {
    let cancelled = false;
    if (!stegoBase64) {
      return;
    }

    activeCanvasRef.current = null;
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
