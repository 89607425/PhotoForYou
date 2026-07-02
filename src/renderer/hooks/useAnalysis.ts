import { useState, useCallback, useRef } from 'react';
import * as Comlink from 'comlink';
import type { PhotoEntry, AnalysisResult, ScoredPhoto, BatchScores, FaceResult } from '../types';
import type { WorkerAPI } from '../../workers/analysis.worker';
import { api } from '../api';

export interface UseAnalysisReturn {
  scoredPhotos: ScoredPhoto[];
  analyze: (photos: PhotoEntry[], sessionId: string) => Promise<void>;
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

  const analyze = useCallback(async (photos: PhotoEntry[], sessionId: string) => {
    if (photos.length === 0) return;
    setIsAnalyzing(true);
    setProgress(0);
    setProgressText('正在检测人脸……');

    try {
      const faceDataMap = await api.analyzeFaces(sessionId);

      setProgress(10);
      setProgressText('正在认真看每一张……');

      const workers: Worker[] = [];
      for (let i = 0; i < WORKER_COUNT; i++) {
        workers.push(new Worker(new URL('../../workers/analysis.worker.ts', import.meta.url), { type: 'module' }));
      }
      workersRef.current = workers;
      const workerWrappers = workers.map((w) => Comlink.wrap<WorkerAPI>(w));

      const results: AnalysisResult[] = new Array(photos.length);
      let completed = 0;
      const total = photos.length;
      let index = 0;

      const processNext = async (workerWrapper: WorkerAPI): Promise<void> => {
        while (index < total) {
          const currentIndex = index++;
          const photo = photos[currentIndex];
          try {
            const result = await workerWrapper.analyze({
              id: photo.id,
              mediumUrl: photo.mediumUrl,
              faceData: faceDataMap.get(photo.id),
            });
            results[currentIndex] = result;
            completed++;
            setProgress(Math.round((completed / total) * 100));
            setProgressText(`正在认真看每一张…… (${completed}/${total})`);
          } catch (err) {
            console.error(`分析失败 ${photo.name}:`, err);
            results[currentIndex] = {
              id: photo.id, faceDetected: false, laplacianVar: 0, brightnessMean: 128,
              isEyesClosed: false, isMouthOpen: false, isTilted: false, isFaceClipped: false,
              isFaceTooSmall: false, isRejected: false, rejectionReasons: [],
            };
            completed++;
            setProgress(Math.round((completed / total) * 100));
            setProgressText(`正在认真看每一张…… (${completed}/${total})`);
          }
        }
      };

      await Promise.all(workers.map((_, i) => processNext(workerWrappers[i])));

      const validResults = results.filter((r) => r !== undefined && r !== null);
      const laplacianVars = validResults.map((r) => r.laplacianVar);
      const brightnessMeans = validResults.map((r) => r.brightnessMean);
      const smileScores = validResults.map((r) => r.smileScore).filter((s): s is number => s !== undefined);

      const sortedBySharpness = [...laplacianVars].sort((a, b) => b - a);
      const lapRankMap = new Map<number, number>();
      sortedBySharpness.forEach((val, rank) => { if (!lapRankMap.has(val)) lapRankMap.set(val, total - rank); });

      const exposureIdeal = 128;
      const maxExposureDeviation = Math.max(...brightnessMeans.map((b) => Math.abs(b - exposureIdeal)));

      const scored: ScoredPhoto[] = validResults.map((result, i) => {
        const blurRank = lapRankMap.get(result.laplacianVar) ?? 0;
        const deviation = Math.abs(result.brightnessMean - exposureIdeal);
        const exposureScore = maxExposureDeviation > 0 ? Math.round(((maxExposureDeviation - deviation) / maxExposureDeviation) * 100) : 100;

        let smileTrend = 50;
        if (result.smileScore !== undefined && smileScores.length > 0) {
          const sorted = [...smileScores].sort((a, b) => a - b);
          const rank = sorted.findIndex((s) => s >= result.smileScore!);
          smileTrend = rank >= 0 ? Math.round((rank / sorted.length) * 100) : 50;
        }

        const faceSharpness = result.faceDetected
          ? Math.min(Math.round((blurRank / total) * 100), 100) : Math.round((blurRank / total) * 50);

        let totalScore = Math.round((blurRank / total) * 30 + (exposureScore / 100) * 20 + (faceSharpness / 100) * 25 + (smileTrend / 100) * 15);
        if (result.faceDetected) totalScore = Math.min(totalScore + 10, 100);
        if (result.isRejected) totalScore = Math.round(totalScore * 0.3);

        return {
          ...photos[i], ...result, blurRank, exposureScore, smileTrend, faceSharpness, totalScore,
          status: result.isRejected ? 'rejected' : 'unreviewed',
        };
      });

      setScoredPhotos(scored);
    } catch (err) {
      console.error('分析流程失败:', err);
    } finally {
      workersRef.current.forEach((w) => w.terminate());
      workersRef.current = [];
      setIsAnalyzing(false);
      setProgress(100);
      setProgressText('分析完成！');
    }
  }, []);

  return { scoredPhotos, analyze, isAnalyzing, progress, progressText };
}
