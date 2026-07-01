import { useState, useCallback } from 'react';
import type { PhotoEntry } from '../types';

export interface UsePhotoListReturn {
  photos: PhotoEntry[];
  importFolder: () => Promise<void>;
  isImporting: boolean;
  progress: number; // 0-100
}

export function usePhotoList(): UsePhotoListReturn {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const importFolder = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) {
      console.warn('electronAPI not available');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      // Step 1: Open folder dialog
      const folderPath = await api.openFolder();
      if (!folderPath) {
        setIsImporting(false);
        return;
      }

      setProgress(10);

      // Step 2: Scan directory
      const scanResult = await api.scanPhotos(folderPath);
      if (!scanResult.success || !scanResult.photos) {
        console.error('Scan failed:', scanResult.error);
        setIsImporting(false);
        return;
      }

      setProgress(30);

      const filePaths = scanResult.photos.map((p) => p.filePath);

      // Step 3: Generate thumbnails
      const cacheDir = `${folderPath}/.photoforyou_cache`;
      const thumbResult = await api.generateThumbnails(filePaths, cacheDir);
      if (!thumbResult.success || !thumbResult.thumbnails) {
        console.error('Thumbnail generation failed:', thumbResult.error);
        setIsImporting(false);
        return;
      }

      setProgress(80);

      // Step 4: Build PhotoEntry array
      const entries: PhotoEntry[] = thumbResult.thumbnails.map((t) => ({
        filePath: t.filePath,
        thumbPath: t.thumbPath,
        name: t.filePath.split(/[/\\]/).pop() || t.filePath,
      }));

      setProgress(100);
      setPhotos(entries);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  }, []);

  return {
    photos,
    importFolder,
    isImporting,
    progress,
  };
}
