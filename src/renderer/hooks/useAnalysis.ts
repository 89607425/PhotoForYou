import { useState, useCallback, useRef } from 'react';
import * as Comlink from 'comlink';
import type { PhotoEntry, AnalysisResult, ScoredPhoto, BatchScores } from '../types';
import type { WorkerAPI } from '../../workers/analysis.worker';

export interface UseAnalysisReturn {
  scoredPhotos: ScoredPhoto[];
  analyze: (photos: PhotoEntry[]) => Promise<void>;
  isAnalyzing: boolean;
  progress: number;
  progressText: string;
}

const WORKER_COUNT = 4;

export function useAnalysis(): UseAnalysisReturn {
  const [scoredPhotos, setScoredPhotos] = useState<ScoredPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const workersRef = useRef<Worker[]>([]);

  const analyze = useCallback(async (photos: PhotoEntry[]) => {
    if (photos.length === 0) return;

    setIsAnalyzing(true);
    setProgress(0);
    setProgressText('正在认真看每一张……');

    try {
      // Create worker pool
      const workers: Worker[] = [];
      for (let i = 0; i < WORKER_COUNT; i++) {
        const worker = new Worker(
          new URL('../../workers/analysis.worker.ts', import.meta.url),
          { type: 'module' }
        );
        workers.push(worker);
      }
      workersRef.current = workers;

      const workerWrappers = workers.map(
        (w) => Comlink.wrap<WorkerAPI>(w)
      );

      // Prepare analysis tasks
      const results: AnalysisResult[] = new Array(photos.length);
      let completed = 0;
      const total = photos.length;

      // Process in batches using the worker pool
      let index = 0;

      const processNext = async (workerWrapper: WorkerAPI): Promise<void> => {
        while (index < total) {
          const currentIndex = index++;
          const photo = photos[currentIndex];

          try {
            // Request medium-sized image from electron main
            const mediumBuffer = await window.electronAPI.readMediumImage(photo.filePath);
            if (!mediumBuffer) {
              throw new Error('Failed to read medium image');
            }

            // Create a blob URL for the worker
            const blob = new Blob([mediumBuffer], { type: 'image/jpeg' });
            const mediumPath = URL.createObjectURL(blob);

            const result = await workerWrapper.analyze({
              filePath: photo.filePath,
              mediumPath,
              thumbPath: photo.thumbPath,
              index: currentIndex,
            });

            // Clean up blob URL
            URL.revokeObjectURL(mediumPath);

            results[currentIndex] = result;
            completed++;
            setProgress(Math.round((completed / total) * 100));
            setProgressText(`正在认真看每一张…… (${completed}/${total})`);
          } catch (err) {
            console.error(`Analysis failed for ${photo.filePath}:`, err);
            // Provide a fallback result for failed analyses
            results[currentIndex] = {
              filePath: photo.filePath,
              faceDetected: false,
              laplacianVar: 0,
              brightnessMean: 128,
              isEyesClosed: false,
              isMouthOpen: false,
              isTilted: false,
              isFaceClipped: false,
              isFaceTooSmall: false,
              isRejected: false,
              rejectionReasons: [],
            };
            completed++;
            setProgress(Math.round((completed / total) * 100));
            setProgressText(`正在认真看每一张…… (${completed}/${total})`);
          }
        }
      };

      // Start all workers
      await Promise.all(workers.map((_, i) => processNext(workerWrappers[i])));

      // Compute batch-relative scores
      const validResults = results.filter((r) => r !== undefined && r !== null);
      const laplacianVars = validResults.map((r) => r.laplacianVar);
      const brightnessMeans = validResults.map((r) => r.brightnessMean);
      const smileScores = validResults
        .map((r) => r.smileScore)
        .filter((s): s is number => s !== undefined);

      // Sort and rank for blur (higher Laplacian variance = sharper)
      const sortedBySharpness = [...laplacianVars].sort((a, b) => b - a);
      const lapRankMap = new Map<number, number>();
      sortedBySharpness.forEach((val, rank) => {
        if (!lapRankMap.has(val)) {
          lapRankMap.set(val, total - rank);
        }
      });

      // For exposure, ideal brightness is around 128 (mid-gray)
      const exposureIdeal = 128;
      const maxExposureDeviation = Math.max(
        ...brightnessMeans.map((b) => Math.abs(b - exposureIdeal))
      );

      // Build ScoredPhoto array
      const scored: ScoredPhoto[] = validResults.map((result, i) => {
        const blurRank = lapRankMap.get(result.laplacianVar) ?? 0;

        // Exposure score: how close to ideal (0-100)
        const deviation = Math.abs(result.brightnessMean - exposureIdeal);
        const exposureScore = maxExposureDeviation > 0
          ? Math.round(((maxExposureDeviation - deviation) / maxExposureDeviation) * 100)
          : 100;

        // Smile trend: percentile rank among photos with faces
        let smileTrend = 50;
        if (result.smileScore !== undefined && smileScores.length > 0) {
          const sorted = [...smileScores].sort((a, b) => a - b);
          const rank = sorted.findIndex((s) => s >= result.smileScore!);
          smileTrend = rank >= 0 ? Math.round((rank / sorted.length) * 100) : 50;
        }

        // Face sharpness: combine blur rank and face detection
        const faceSharpness = result.faceDetected
          ? Math.min(Math.round((blurRank / total) * 100), 100)
          : Math.round((blurRank / total) * 50); // Lower weight if no face

        // Compute total score (0-100)
        // Weights: blur 30%, exposure 20%, face sharpness 25%, smile 15%, face detected bonus 10%
        let totalScore = Math.round(
          (blurRank / total) * 30 +
          (exposureScore / 100) * 20 +
          (faceSharpness / 100) * 25 +
          (smileTrend / 100) * 15
        );
        if (result.faceDetected) {
          totalScore = Math.min(totalScore + 10, 100);
        }
        // Penalize rejected photos
        if (result.isRejected) {
          totalScore = Math.round(totalScore * 0.3);
        }

        const batchScores: BatchScores = {
          blurRank,
          exposureScore,
          smileTrend,
          faceSharpness,
          totalScore,
        };

        return {
          ...photos[i],
          ...result,
          ...batchScores,
          status: result.isRejected ? 'rejected' : 'unreviewed',
        };
      });

      setScoredPhotos(scored);
    } catch (err) {
      console.error('Analysis pipeline failed:', err);
    } finally {
      // Clean up workers
      workersRef.current.forEach((w) => w.terminate());
      workersRef.current = [];
      setIsAnalyzing(false);
      setProgress(100);
      setProgressText('分析完成！');
    }
  }, []);

  return {
    scoredPhotos,
    analyze,
    isAnalyzing,
    progress,
    progressText,
  };
}
