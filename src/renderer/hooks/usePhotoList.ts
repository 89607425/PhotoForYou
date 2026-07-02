import { useState, useCallback } from 'react';
import type { PhotoEntry } from '../types';
import { api } from '../api';

export interface UsePhotoListReturn {
  photos: PhotoEntry[];
  sessionId: string;
  importFromFiles: (files: File[]) => Promise<void>;
  isImporting: boolean;
  progress: number;
}

export function usePhotoList(): UsePhotoListReturn {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const importFromFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsImporting(true);
    setProgress(0);

    try {
      let sid = sessionId;
      if (!sid) {
        setProgress(10);
        sid = await api.createSession();
        setSessionId(sid);
      }

      setProgress(40);
      const results = await api.uploadPhotos(sid, files);

      setProgress(90);
      const entries: PhotoEntry[] = results.map((p) => ({
        id: p.id,
        name: p.name,
        size: p.size,
        thumbnailUrl: p.thumbnailUrl,
        mediumUrl: p.mediumUrl,
        fullUrl: p.fullUrl,
      }));

      setProgress(100);
      setPhotos(entries);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  }, [sessionId]);

  return { photos, sessionId, importFromFiles, isImporting, progress };
}
