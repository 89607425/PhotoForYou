const BASE = `/api`;

export interface UploadPhoto {
  id: string;
  name: string;
  size: number;
  thumbnailUrl: string;
  mediumUrl: string;
  fullUrl: string;
}

export interface FaceData {
  faceDetected: boolean;
  ear?: number;
  mar?: number;
  roll?: number;
  faceBbox?: { x: number; y: number; w: number; h: number };
  faceRatio?: number;
  marginRatio?: number;
  smileScore?: number;
}

export const api = {
  createSession: async (): Promise<string> => {
    const res = await fetch(`${BASE}/sessions`, { method: 'POST' });
    const data = await res.json();
    return data.sessionId;
  },

  uploadPhotos: async (sessionId: string, files: File[]): Promise<UploadPhoto[]> => {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    const res = await fetch(`${BASE}/sessions/${sessionId}/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    return data.photos;
  },

  analyzeFaces: async (sessionId: string): Promise<Map<string, FaceData>> => {
    const res = await fetch(`${BASE}/sessions/${sessionId}/analyze`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Analysis failed');
    const map = new Map<string, FaceData>();
    for (const r of data.results) {
      if (r.faceData?.faceDetected) {
        map.set(r.photoId, r.faceData);
      }
    }
    return map;
  },

  getThumbnailUrl: (sessionId: string, photoId: string): string =>
    `${BASE}/sessions/${sessionId}/photos/${photoId}/thumbnail`,

  getMediumUrl: (sessionId: string, photoId: string): string =>
    `${BASE}/sessions/${sessionId}/photos/${photoId}/medium`,

  getFullUrl: (sessionId: string, photoId: string): string =>
    `${BASE}/sessions/${sessionId}/photos/${photoId}/full`,

  computeHash: async (sessionId: string, photoId: string): Promise<string | null> => {
    const res = await fetch(`${BASE}/sessions/${sessionId}/compute-hash/${photoId}`, { method: 'POST' });
    const data = await res.json();
    return data.success ? data.hash : null;
  },

  exportPhotos: async (sessionId: string, photoIds: string[]): Promise<void> => {
    const res = await fetch(`${BASE}/sessions/${sessionId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photoforyou-export-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
