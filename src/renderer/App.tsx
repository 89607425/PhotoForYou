import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { ScoredPhoto, ReviewAction } from './types';
import { usePhotoList } from './hooks/usePhotoList';
import { useAnalysis } from './hooks/useAnalysis';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { PhotoViewer } from './components/PhotoViewer';
import { ExportPanel } from './components/ExportPanel';
import { api } from './api';

type AppPhase = 'idle' | 'importing' | 'analyzing' | 'reviewing' | 'export';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [scoredPhotosLocal, setScoredPhotosLocal] = useState<ScoredPhoto[]>([]);

  const {
    photos,
    sessionId,
    importFromFiles,
    isImporting,
    progress: importProgress,
  } = usePhotoList();

  const {
    scoredPhotos,
    analyze,
    isAnalyzing,
    progress: analysisProgress,
    progressText,
  } = useAnalysis();

  const handleImportFiles = useCallback(async (files: File[]) => {
    setPhase('importing');
    try {
      await importFromFiles(files);
    } catch (err) {
      console.error('Import error:', err);
      setPhase('idle');
    }
  }, [importFromFiles]);

  useEffect(() => {
    if (phase === 'importing' && !isImporting && photos.length > 0) {
      setPhase('analyzing');
    }
    if (phase === 'importing' && !isImporting && photos.length === 0) {
      setPhase('idle');
    }
  }, [phase, isImporting, photos.length]);

  useEffect(() => {
    if (phase === 'analyzing' && photos.length > 0 && !isAnalyzing && scoredPhotos.length === 0 && sessionId) {
      analyze(photos, sessionId).then(() => {
        setPhase('reviewing');
        setReviewIndex(0);
      });
    }
  }, [phase, photos, isAnalyzing, scoredPhotos.length, analyze, sessionId]);

  useEffect(() => {
    if (scoredPhotos.length > 0 && scoredPhotosLocal.length === 0) {
      setScoredPhotosLocal(scoredPhotos);
    }
  }, [scoredPhotos, scoredPhotosLocal.length]);

  const handleSwipe = useCallback(
    (action: ReviewAction) => {
      setScoredPhotosLocal((prev) => {
        const updated = [...prev];
        if (reviewIndex < updated.length) {
          switch (action) {
            case 'select':
              updated[reviewIndex] = { ...updated[reviewIndex], status: 'selected' };
              break;
            case 'reject':
              updated[reviewIndex] = { ...updated[reviewIndex], status: 'rejected' };
              break;
            case 'maybe':
              updated[reviewIndex] = { ...updated[reviewIndex], status: 'maybe' };
              break;
          }
        }
        return updated;
      });

      if (reviewIndex < scoredPhotosLocal.length - 1) {
        setTimeout(() => {
          setReviewIndex((i) => i + 1);
        }, 200);
      } else {
        setTimeout(() => {
          setPhase('export');
        }, 300);
      }
    },
    [reviewIndex, scoredPhotosLocal.length]
  );

  const handlePrev = useCallback(() => {
    if (reviewIndex > 0) {
      setReviewIndex((i) => i - 1);
    }
  }, [reviewIndex]);

  const handleNext = useCallback(() => {
    if (reviewIndex < scoredPhotosLocal.length - 1) {
      setReviewIndex((i) => i + 1);
    }
  }, [reviewIndex, scoredPhotosLocal.length]);

  const handleExport = useCallback(async () => {
    const selected = scoredPhotosLocal.filter((p) => p.status === 'selected');
    if (selected.length > 0 && sessionId) {
      await api.exportPhotos(sessionId, selected.map((p) => p.id));
    }
  }, [scoredPhotosLocal, sessionId]);

  const handleBackToReview = useCallback(() => {
    setPhase('reviewing');
  }, []);

  const selectedCount = useMemo(
    () => scoredPhotosLocal.filter((p) => p.status === 'selected').length,
    [scoredPhotosLocal]
  );
  const rejectedCount = useMemo(
    () => scoredPhotosLocal.filter(
      (p) => p.status === 'rejected' ||
        (p.isRejected && p.status !== 'maybe' && p.status !== 'selected')
    ).length,
    [scoredPhotosLocal]
  );
  const maybeCount = useMemo(
    () => scoredPhotosLocal.filter((p) => p.status === 'maybe').length,
    [scoredPhotosLocal]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">PhotoForYou</h1>
        <p className="app-subtitle">AI 智能照片筛选</p>
      </header>

      <main className="app-main">
        {phase === 'idle' && (
          <DropZone
            hasPhotos={false}
            isImporting={false}
            progress={0}
            onImportFiles={handleImportFiles}
            photoCount={0}
          />
        )}

        {phase === 'importing' && photos.length === 0 && (
          <DropZone
            hasPhotos={false}
            isImporting
            progress={importProgress}
            onImportFiles={() => {}}
            photoCount={0}
          />
        )}

        {phase === 'analyzing' && (
          <div className="phase-container">
            <ProgressBar progress={analysisProgress} text={progressText} />
          </div>
        )}

        {phase === 'reviewing' && scoredPhotosLocal.length > 0 && (
          <PhotoViewer
            photo={scoredPhotosLocal[reviewIndex]}
            onSwipe={handleSwipe}
            onPrev={handlePrev}
            onNext={handleNext}
            hasPrev={reviewIndex > 0}
            hasNext={reviewIndex < scoredPhotosLocal.length - 1}
            totalCount={scoredPhotosLocal.length}
            currentIndex={reviewIndex}
          />
        )}

        {phase === 'export' && (
          <ExportPanel
            selectedCount={selectedCount}
            rejectedCount={rejectedCount}
            maybeCount={maybeCount}
            totalCount={scoredPhotosLocal.length}
            onExport={handleExport}
            onBack={handleBackToReview}
          />
        )}
      </main>
    </div>
  );
};

export default App;
