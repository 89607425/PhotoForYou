import * as Comlink from 'comlink';
import type { AnalysisResult, WorkerAnalysisRequest } from '../renderer/types';

const workerAPI = {
  async analyze(request: WorkerAnalysisRequest): Promise<AnalysisResult> {
    const { id, mediumUrl, faceData } = request;

    const image = await loadImage(mediumUrl);
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

    const laplacianVar = computeLaplacianVariance(pixels, width, height);
    const brightnessMean = computeBrightnessMean(pixels, width, height);

    const faceDetected = faceData?.faceDetected ?? false;
    const ear = faceData?.ear;
    const mar = faceData?.mar;
    const roll = faceData?.roll;
    const faceBbox = faceData?.faceBbox;
    const faceRatio = faceData?.faceRatio;
    const marginRatio = faceData?.marginRatio;
    const smileScore = faceData?.smileScore;

    const rejectionReasons: string[] = [];
    let isEyesClosed = false;
    let isMouthOpen = false;
    let isTilted = false;
    let isFaceClipped = false;
    let isFaceTooSmall = false;

    const isBlurry = laplacianVar < 30;
    const isUnderexposed = brightnessMean < 40;
    const isOverexposed = brightnessMean > 240;

    if (isBlurry) rejectionReasons.push('手抖了');
    if (isUnderexposed) rejectionReasons.push('太暗了');
    if (isOverexposed) rejectionReasons.push('过曝了');

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
      if (faceBbox && (faceBbox.x < 0 || faceBbox.y < 0 || faceBbox.x + faceBbox.w > 1 || faceBbox.y + faceBbox.h > 1)) {
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
      id,
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
      if (!response.ok) throw new Error(`Failed to load image from ${src}: ${response.status}`);
      return response.blob();
    })
    .then((blob) => createImageBitmap(blob));
}

function computeLaplacianVariance(pixels: Uint8ClampedArray, width: number, height: number): number {
  const maxDim = 512;
  let scale = 1;
  if (width > maxDim || height > maxDim) {
    scale = Math.min(maxDim / width, maxDim / height);
  }
  const sw = Math.floor(width * scale);
  const sh = Math.floor(height * scale);

  const gray: number[] = new Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const idx = (srcY * width + srcX) * 4;
      gray[y * sw + x] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    }
  }

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
  return Math.max(0, sumSq / count - mean * mean);
}

function computeBrightnessMean(pixels: Uint8ClampedArray, width: number, height: number): number {
  const totalPixels = width * height;
  let totalValue = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    totalValue += Math.max(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
  }
  return totalValue / totalPixels;
}

Comlink.expose(workerAPI);

export type WorkerAPI = typeof workerAPI;
