import * as Comlink from 'comlink';
import type { AnalysisResult, WorkerAnalysisRequest } from '../renderer/types';

const workerAPI = {
  async analyze(request: WorkerAnalysisRequest): Promise<AnalysisResult> {
    const { filePath, mediumPath, thumbPath } = request;

    const image = await loadImage(mediumPath);
    const width = image.width;
    const height = image.height;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2d context from OffscreenCanvas');
    }
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Compute Laplacian variance (blur detection) on a downsampled grayscale version
    const laplacianVar = computeLaplacianVariance(pixels, width, height);

    // Compute brightness mean in HSV space
    const brightnessMean = computeBrightnessMean(pixels, width, height);

    // Face detection: MediaPipe FaceMesh integration is pending.
    // When integrated, it will provide facial landmarks for computing
    // EAR, MAR, roll, face ratio, margin ratio, and smile score.
    // For now, face detection is stubbed out to allow end-to-end app flow.
    const faceDetected = false;
    const ear: number | undefined = undefined;
    const mar: number | undefined = undefined;
    const roll: number | undefined = undefined;
    const faceBbox: { x: number; y: number; w: number; h: number } | undefined = undefined;
    const faceRatio: number | undefined = undefined;
    const marginRatio: number | undefined = undefined;
    const smileScore: number | undefined = undefined;

    // Rejection logic
    const rejectionReasons: string[] = [];
    let isEyesClosed = false;
    let isMouthOpen = false;
    let isTilted = false;
    let isFaceClipped = false;
    let isFaceTooSmall = false;

    // Blur check: images with very low Laplacian variance are blurry
    const isBlurry = laplacianVar < 30;

    // Exposure check: very dark or very bright
    const isUnderexposed = brightnessMean < 40;
    const isOverexposed = brightnessMean > 240;

    if (isBlurry) {
      rejectionReasons.push('手抖了');
    }
    if (isUnderexposed) {
      rejectionReasons.push('太暗了');
    }
    if (isOverexposed) {
      rejectionReasons.push('过曝了');
    }

    if (faceDetected) {
      if (ear !== undefined && ear < 0.2) {
        isEyesClosed = true;
        rejectionReasons.push('闭眼了');
      }
      if (mar !== undefined && mar > 0.6) {
        isMouthOpen = true;
        rejectionReasons.push('嘴张太大了');
      }
      if (roll !== undefined && Math.abs(roll) > 15) {
        isTilted = true;
        rejectionReasons.push('歪了');
      }
      const bbox = faceBbox as { x: number; y: number; w: number; h: number } | undefined;
      if (bbox && (bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.w > 1 || bbox.y + bbox.h > 1)) {
        isFaceClipped = true;
        rejectionReasons.push('脸被切了');
      }
      if (faceRatio !== undefined && faceRatio < 0.05) {
        isFaceTooSmall = true;
        rejectionReasons.push('脸太小了');
      }
    }

    const isRejected = rejectionReasons.length > 0;

    return {
      filePath,
      faceDetected,
      ear,
      mar,
      roll,
      faceBbox,
      faceRatio,
      marginRatio,
      smileScore,
      laplacianVar,
      brightnessMean,
      isEyesClosed,
      isMouthOpen,
      isTilted,
      isFaceClipped,
      isFaceTooSmall,
      isRejected,
      rejectionReasons,
    };
  },
};

function loadImage(src: string): Promise<ImageBitmap> {
  return fetch(src)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => createImageBitmap(blob));
}

function computeLaplacianVariance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): number {
  // Downsample to at most 512px on the long edge for performance
  const maxDim = 512;
  let scale = 1;
  if (width > maxDim || height > maxDim) {
    scale = Math.min(maxDim / width, maxDim / height);
  }
  const sw = Math.floor(width * scale);
  const sh = Math.floor(height * scale);

  // Convert to grayscale using luminance weights
  const gray: number[] = new Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const idx = (srcY * width + srcX) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      gray[y * sw + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  // Apply Laplacian kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]]
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const lap =
        gray[(y - 1) * sw + x] +
        gray[(y + 1) * sw + x] +
        gray[y * sw + (x - 1)] +
        gray[y * sw + (x + 1)] -
        4 * gray[y * sw + x];

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  return Math.max(0, variance);
}

function computeBrightnessMean(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const totalPixels = width * height;
  let totalValue = 0;

  // Use the V channel of HSV approximation: max(R, G, B)
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    totalValue += Math.max(r, g, b);
  }

  return totalValue / totalPixels;
}

Comlink.expose(workerAPI);

export type WorkerAPI = typeof workerAPI;
