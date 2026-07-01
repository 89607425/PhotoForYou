import React from 'react';
import type { ScoredPhoto } from '../types';

interface ScorePanelProps {
  photo: ScoredPhoto;
}

interface DimensionBarProps {
  label: string;
  value: number; // 0-10
  color?: string;
}

const DimensionBar: React.FC<DimensionBarProps> = ({
  label,
  value,
  color = '#FF8A80',
}) => {
  const clampedValue = Math.max(0, Math.min(10, value));
  const percentage = clampedValue * 10;

  return (
    <div className="dimension-bar">
      <div className="dimension-label">{label}</div>
      <div className="dimension-track">
        <div
          className="dimension-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="dimension-value">{clampedValue.toFixed(1)}</div>
    </div>
  );
};

export const ScorePanel: React.FC<ScorePanelProps> = ({ photo }) => {
  // Map batch scores to 0-10 scale dimensions
  const clarityScore = photo.laplacianVar > 0
    ? Math.min(10, (photo.laplacianVar / 200) * 10)
    : 0;

  const exposureScore = photo.exposureScore / 10;

  const portraitScore = photo.faceDetected
    ? Math.min(10, 3 + (photo.faceSharpness / 100) * 7)
    : 0;

  const expressionScore = photo.faceDetected
    ? photo.smileScore !== undefined
      ? Math.min(10, photo.smileScore * 10)
      : 0
    : 0;

  const compositionScore = photo.faceDetected
    ? Math.min(10, 3 + (photo.faceSharpness / 100) * 5 + (photo.blurRank / (photo.blurRank + 1)) * 2)
    : Math.min(10, (photo.blurRank / (photo.blurRank + 1)) * 6 + (exposureScore / 10) * 4);

  const totalDisplay = Math.round(photo.totalScore);

  const getTotalColor = (score: number): string => {
    if (score >= 70) return '#4CAF50';
    if (score >= 40) return '#FF9800';
    return '#F44336';
  };

  return (
    <div className="score-panel">
      <div className="score-header">
        <div className="score-total-wrapper">
          <div
            className="score-total-circle"
            style={{ borderColor: getTotalColor(totalDisplay), color: getTotalColor(totalDisplay) }}
          >
            {totalDisplay}
          </div>
        </div>
        <div className="score-status">
          {photo.status === 'selected' && <span className="badge badge-selected">已选</span>}
          {photo.status === 'rejected' && <span className="badge badge-rejected">已拒绝</span>}
          {photo.status === 'maybe' && <span className="badge badge-maybe">再看看</span>}
          {photo.isRejected && photo.status !== 'rejected' && (
            <span className="badge badge-warn">AI 建议拒绝</span>
          )}
        </div>
      </div>

      <div className="score-dimensions">
        <DimensionBar label="清晰度" value={clarityScore} color="#4FC3F7" />
        <DimensionBar label="曝光" value={exposureScore} color="#FFB74D" />
        <DimensionBar label="人像" value={portraitScore} color="#CE93D8" />
        <DimensionBar label="表情" value={expressionScore} color="#FF8A80" />
        <DimensionBar label="构图" value={compositionScore} color="#81C784" />
      </div>

      {photo.rejectionReasons.length > 0 && (
        <div className="rejection-reasons">
          <h4 className="rejection-title">AI 提示</h4>
          <div className="rejection-tags">
            {photo.rejectionReasons.map((reason, i) => (
              <span key={i} className="rejection-tag">{reason}</span>
            ))}
          </div>
        </div>
      )}

      {photo.faceDetected && (
        <div className="face-info">
          <h4 className="face-info-title">人脸分析</h4>
          <div className="face-info-grid">
            {photo.ear !== undefined && (
              <div className="face-info-item">
                <span className="face-info-label">眼睛开合</span>
                <span className="face-info-val">{photo.isEyesClosed ? '闭眼' : '正常'}</span>
              </div>
            )}
            {photo.mar !== undefined && (
              <div className="face-info-item">
                <span className="face-info-label">嘴部</span>
                <span className="face-info-val">{photo.isMouthOpen ? '张嘴' : '正常'}</span>
              </div>
            )}
            {photo.roll !== undefined && (
              <div className="face-info-item">
                <span className="face-info-label">倾斜</span>
                <span className="face-info-val">{photo.isTilted ? '歪了' : '端正'}</span>
              </div>
            )}
            {photo.smileScore !== undefined && (
              <div className="face-info-item">
                <span className="face-info-label">笑容</span>
                <span className="face-info-val">{(photo.smileScore * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="photo-meta">
        <div className="photo-meta-item">
          <span className="photo-meta-label">文件名</span>
          <span className="photo-meta-val">{photo.name}</span>
        </div>
      </div>
    </div>
  );
};
