import React from 'react';

interface DropZoneProps {
  hasPhotos: boolean;
  isImporting: boolean;
  progress: number;
  onImport: () => void;
  photoCount: number;
}

export const DropZone: React.FC<DropZoneProps> = ({
  hasPhotos,
  isImporting,
  progress,
  onImport,
  photoCount,
}) => {
  if (hasPhotos && !isImporting) {
    return (
      <div className="dropzone dropzone-compact">
        <span className="dropzone-info">
          已加载 <strong>{photoCount}</strong> 张照片
        </span>
        <button className="dropzone-btn" onClick={onImport}>
          换一批
        </button>
      </div>
    );
  }

  if (isImporting) {
    return (
      <div className="dropzone dropzone-importing">
        <div className="dropzone-spinner" />
        <p className="dropzone-status">
          正在导入照片… {progress > 0 && `${progress}%`}
        </p>
        <div className="dropzone-progress-track">
          <div
            className="dropzone-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dropzone dropzone-idle" onClick={onImport}>
      <div className="dropzone-border">
        <div className="dropzone-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF8A80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21,15 16,10 5,21" />
          </svg>
        </div>
        <p className="dropzone-text">拖入照片文件夹开始</p>
        <p className="dropzone-subtext">或点击这里选择文件夹</p>
        <p className="dropzone-hint">支持 JPG / PNG / HEIC / WEBP</p>
      </div>
    </div>
  );
};
