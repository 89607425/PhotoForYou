interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  scanPhotos: (folderPath: string) => Promise<{
    success: boolean;
    photos?: { filePath: string; name: string; size: number }[];
    count?: number;
    error?: string;
  }>;
  generateThumbnails: (filePaths: string[], cacheDir: string) => Promise<{
    success: boolean;
    thumbnails?: { filePath: string; thumbPath: string }[];
    error?: string;
  }>;
  readFullImage: (filePath: string) => Promise<ArrayBuffer | null>;
  readMediumImage: (filePath: string) => Promise<ArrayBuffer | null>;
  exportPhotos: (
    photos: { src: string; name: string }[],
    destFolder: string,
    mode: 'selected' | 'rejected'
  ) => Promise<{ success: boolean; copied?: number; error?: string }>;
  computeHash: (filePath: string) => Promise<{
    success: boolean;
    hash?: string;
    error?: string;
  }>;
  openFolderInShell: (folderPath: string) => Promise<void>;
  detectFaces: (filePaths: string[]) => Promise<{
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
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
