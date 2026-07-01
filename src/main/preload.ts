import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder') as Promise<string | null>,
  scanPhotos: (folderPath: string) =>
    ipcRenderer.invoke('photos:scan', folderPath) as Promise<{
      success: boolean;
      photos?: { filePath: string; name: string; size: number }[];
      count?: number;
      error?: string;
    }>,
  generateThumbnails: (filePaths: string[], cacheDir: string) =>
    ipcRenderer.invoke('photos:generateThumbnails', filePaths, cacheDir) as Promise<{
      success: boolean;
      thumbnails?: { filePath: string; thumbPath: string }[];
      error?: string;
    }>,
  readFullImage: (filePath: string) =>
    ipcRenderer.invoke('photos:readFull', filePath) as Promise<ArrayBuffer | null>,
  readMediumImage: (filePath: string) =>
    ipcRenderer.invoke('photos:readMedium', filePath) as Promise<ArrayBuffer | null>,
  exportPhotos: (
    photos: { src: string; name: string }[],
    destFolder: string,
    mode: 'selected' | 'rejected'
  ) =>
    ipcRenderer.invoke('photos:export', photos, destFolder, mode) as Promise<{
      success: boolean;
      copied?: number;
      error?: string;
    }>,
  computeHash: (filePath: string) =>
    ipcRenderer.invoke('photos:computeHash', filePath) as Promise<{
      success: boolean;
      hash?: string;
      error?: string;
    }>,
  openFolderInShell: (folderPath: string) => ipcRenderer.invoke('shell:openFolder', folderPath),
  detectFaces: (filePaths: string[]) =>
    ipcRenderer.invoke('photos:detectFaces', filePaths) as Promise<{
      success: boolean;
      results?: {
        faceDetected: boolean;
        ear?: number;
        mar?: number;
        roll?: number;
        faceBbox?: { x: number; y: number; w: number; h: number };
        faceRatio?: number;
        marginRatio?: number;
        smileScore?: number;
      }[];
      error?: string;
    }>,
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
