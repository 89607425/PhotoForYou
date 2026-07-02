import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs-node';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface FaceAnalysisResult {
  faceDetected: boolean;
  ear?: number;
  mar?: number;
  roll?: number;
  faceBbox?: { x: number; y: number; w: number; h: number };
  faceRatio?: number;
  marginRatio?: number;
  smileScore?: number;
}

let initialized = false;

export async function initFaceDetection(): Promise<void> {
  if (initialized) return;

  await tf.ready();
  await tf.setBackend('tensorflow');

  const modelPath = path.join(__dirname, '../../assets/models');
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Models directory not found: ${modelPath}`);
  }

  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(modelPath);
  await faceapi.nets.faceExpressionNet.loadFromDisk(modelPath);

  initialized = true;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeEAR(eyePoints: { x: number; y: number }[]): number {
  if (eyePoints.length !== 6) return 1;
  const d1 = distance(eyePoints[1], eyePoints[5]);
  const d2 = distance(eyePoints[2], eyePoints[4]);
  const d3 = distance(eyePoints[0], eyePoints[3]);
  if (d3 === 0) return 0;
  return (d1 + d2) / (2 * d3);
}

function computeMAR(mouthPoints: { x: number; y: number }[]): number {
  if (mouthPoints.length < 20) return 0;
  const v1 = distance(mouthPoints[3], mouthPoints[9]);
  const v2 = distance(mouthPoints[14], mouthPoints[18]);
  const h = distance(mouthPoints[0], mouthPoints[6]);
  if (h === 0) return 0;
  return (v1 + v2) / (2 * h);
}

function eyeCenter(pts: { x: number; y: number }[]): { x: number; y: number } {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

export async function detectFaces(filePath: string): Promise<FaceAnalysisResult> {
  if (!initialized) {
    await initFaceDetection();
  }

  try {
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    if (width < 80 || height < 80) {
      return { faceDetected: false };
    }

    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);

    const { data, info } = await sharp(filePath)
      .resize(sw, sh, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels < 3) {
      return { faceDetected: false };
    }

    const tensor = tf.tensor3d(new Uint8Array(data), [sh, sw, 3]);

    const detections = await faceapi
      .detectAllFaces(
        tensor as unknown as HTMLCanvasElement,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      )
      .withFaceLandmarks(true)
      .withFaceExpressions();

    tensor.dispose();

    if (detections.length === 0) {
      return { faceDetected: false };
    }

    const detection = detections.reduce((a, b) =>
      a.detection.box.width * a.detection.box.height >
      b.detection.box.width * b.detection.box.height
        ? a
        : b
    );

    const box = detection.detection.box;
    const landmarks = detection.landmarks;
    const expressions = detection.expressions;

    const invScale = 1 / scale;

    const faceBbox = {
      x: (box.x * invScale) / width,
      y: (box.y * invScale) / height,
      w: (box.width * invScale) / width,
      h: (box.height * invScale) / height,
    };

    const faceArea = box.width * box.height * invScale * invScale;
    const imageArea = width * height;
    const faceRatio = faceArea / imageArea;

    const marginLeft = (box.x * invScale) / width;
    const marginTop = (box.y * invScale) / height;
    const marginRight = (width - box.x * invScale - box.width * invScale) / width;
    const marginBottom = (height - box.y * invScale - box.height * invScale) / height;
    const marginRatio = Math.min(marginLeft, marginTop, marginRight, marginBottom);

    const leftEye = landmarks.positions.slice(36, 42);
    const rightEye = landmarks.positions.slice(42, 48);
    const leftEAR = computeEAR(leftEye);
    const rightEAR = computeEAR(rightEye);
    const ear = (leftEAR + rightEAR) / 2;

    const mouth = landmarks.positions.slice(48, 68);
    const mar = computeMAR(mouth);

    const lc = eyeCenter(leftEye);
    const rc = eyeCenter(rightEye);
    const roll = Math.atan2(rc.y - lc.y, rc.x - lc.x) * (180 / Math.PI);

    const smileScore = expressions.happy;

    return {
      faceDetected: true,
      ear,
      mar,
      roll,
      faceBbox,
      faceRatio,
      marginRatio,
      smileScore,
    };
  } catch (err) {
    console.error(`Face detection error for ${filePath}:`, err);
    return { faceDetected: false };
  }
}

export async function detectFacesBatch(filePaths: string[]): Promise<FaceAnalysisResult[]> {
  const batchSize = 4;
  const results: FaceAnalysisResult[] = new Array(filePaths.length);

  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((fp, j) =>
        detectFaces(fp).then((r) => {
          results[i + j] = r;
          return r;
        })
      )
    );
  }

  return results;
}
