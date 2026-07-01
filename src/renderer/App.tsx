import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { ScoredPhoto, ReviewAction } from './types';
import { usePhotoList } from './hooks/usePhotoList';
import { useAnalysis } from './hooks/useAnalysis';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { PhotoViewer } from './components/PhotoViewer';
import { ExportPanel } from './components/ExportPanel';

type AppPhase = 'idle' | 'importing' | 'analyzing' | 'reviewing' | 'export';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [scoredPhotosLocal, setScoredPhotosLocal] = useState<ScoredPhoto[]>([]);

  const {
    photos,
    importFolder,
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

  // Start import flow
  const handleImport = useCallback(async () => {
    setPhase('importing');
    try {
      await importFolder();
    } catch (err) {
      console.error('Import error:', err);
      setPhase('idle');
    }
  }, [importFolder]);

  // Transition: importing finished with photos -> start analyzing
  useEffect(() => {
    if (phase === 'importing' && !isImporting && photos.length > 0) {
      setPhase('analyzing');
    }
    if (phase === 'importing' && !isImporting && photos.length === 0) {
      setPhase('idle');
    }
  }, [phase, isImporting, photos.length]);

  // Transition: entered analyzing phase -> run analysis
  useEffect(() => {
    if (phase === 'analyzing' && photos.length > 0 && !isAnalyzing && scoredPhotos.length === 0) {
      analyze(photos).then(() => {
        setPhase('reviewing');
        setReviewIndex(0);
      });
    }
  }, [phase, photos, isAnalyzing, scoredPhotos.length, analyze]);

  // Sync scoredPhotos from analysis hook to local mutable state
  useEffect(() => {
    if (scoredPhotos.length > 0 && scoredPhotosLocal.length === 0) {
      setScoredPhotosLocal(scoredPhotos);
    }
  }, [scoredPhotos, scoredPhotosLocal.length]);

  // Handle swipe actions during review
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

      // Advance to next photo or finish
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

  // Export flow
  const handleExport = useCallback(async () => {
    const selected = scoredPhotosLocal.filter((p) => p.status === 'selected');

    if (selected.length > 0) {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) return;

      await window.electronAPI.exportPhotos(
        selected.map((p) => ({ src: p.filePath, name: p.name })),
        folderPath,
        'selected'
      );
    }
  }, [scoredPhotosLocal]);

  const handleBackToReview = useCallback(() => {
    setPhase('reviewing');
  }, []);

  // Compute counts for export panel
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
            onImport={handleImport}
            photoCount={0}
          />
        )}

        {phase === 'importing' && photos.length === 0 && (
          <DropZone
            hasPhotos={false}
            isImporting
            progress={importProgress}
            onImport={() => {}}
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
