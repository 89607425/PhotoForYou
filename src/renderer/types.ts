export interface PhotoEntry {
  filePath: string;
  thumbPath: string;
  name: string;
  hash?: string;
}

export interface AnalysisResult {
  filePath: string;
  faceDetected: boolean;
  ear?: number;
  mar?: number;
  roll?: number;
  faceBbox?: { x: number; y: number; w: number; h: number };
  faceRatio?: number;
  marginRatio?: number;
  smileScore?: number;
  laplacianVar: number;
  brightnessMean: number;
  isEyesClosed: boolean;
  isMouthOpen: boolean;
  isTilted: boolean;
  isFaceClipped: boolean;
  isFaceTooSmall: boolean;
  isRejected: boolean;
  rejectionReasons: string[];
}

export interface BatchScores {
  blurRank: number;
  exposureScore: number;
  smileTrend: number;
  faceSharpness: number;
  nimaScore?: number;
  totalScore: number;
}

export interface ScoredPhoto extends PhotoEntry, AnalysisResult, BatchScores {
  status: 'selected' | 'pending' | 'rejected' | 'unreviewed' | 'maybe';
  clusterId?: number;
}

export type ReviewAction = 'select' | 'reject' | 'maybe';

export interface WorkerAnalysisRequest {
  filePath: string;
  mediumPath: string;
  thumbPath: string;
  index: number;
}

export interface WorkerAnalysisResponse {
  index: number;
  result: AnalysisResult;
}
