import React, { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';

interface DropZoneProps {
  hasPhotos: boolean;
  isImporting: boolean;
  progress: number;
  onImportFiles: (files: File[]) => void;
  photoCount: number;
}

const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp']);

function isImageFile(name: string): boolean {
  const ext = name.lastIndexOf('.');
  if (ext === -1) return false;
  return EXTENSIONS.has(name.slice(ext).toLowerCase());
}

function extractFiles(fileList: FileList | null): File[] {
  if (!fileList || fileList.length === 0) return [];
  const files: File[] = [];
  for (let i = 0; i < fileList.length; i++) {
    if (isImageFile(fileList[i].name)) {
      files.push(fileList[i]);
    }
  }
  return files;
}

export const DropZone: React.FC<DropZoneProps> = ({
  hasPhotos,
  isImporting,
  progress,
  onImportFiles,
  photoCount,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = extractFiles(e.dataTransfer.files);
      if (files.length > 0) onImportFiles(files);
    },
    [onImportFiles]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = extractFiles(e.target.files);
      if (files.length > 0) onImportFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onImportFiles]
  );

  const handleClickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (isImporting) {
    return (
      <div className="dropzone dropzone-importing">
        <div className="dropzone-spinner" />
        <p className="dropzone-status">
          正在导入照片 {progress > 0 ? `${progress}%` : '…'}
        </p>
        <div className="dropzone-progress-track">
          <div className="dropzone-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  if (hasPhotos) {
    return (
      <div className="dropzone dropzone-compact">
        <span className="dropzone-info">
          已加载 <strong>{photoCount}</strong> 张照片
        </span>
        <button className="dropzone-btn" onClick={handleClickFiles}>选择照片</button>
        <input ref={fileInputRef} type="file" multiple
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
          style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
    );
  }

  return (
    <div className="dropzone dropzone-idle">
      <div
        className={`dropzone-border ${isDragOver ? 'dropzone-border-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickFiles}
      >
        <div className="dropzone-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#FF8A80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21,15 16,10 5,21" />
          </svg>
        </div>
        <p className="dropzone-text">{isDragOver ? '松开开始导入' : '点击或拖拽照片到此处'}</p>
        <p className="dropzone-subtext">支持多选</p>
        <p className="dropzone-hint">支持 JPG / PNG / HEIC / WEBP</p>
      </div>

      <div className="dropzone-actions">
        <button className="dropzone-action-btn" onClick={handleClickFiles}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21,15 16,10 5,21" />
          </svg>
          <span>选择照片</span>
        </button>
      </div>

      <input ref={fileInputRef} type="file" multiple
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
};
