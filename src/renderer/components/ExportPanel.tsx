import React, { useState } from 'react';

interface ExportPanelProps {
  selectedCount: number;
  rejectedCount: number;
  maybeCount: number;
  totalCount: number;
  onExport: () => Promise<void>;
  onBack: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  selectedCount,
  rejectedCount,
  maybeCount,
  totalCount,
  onExport,
  onBack,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [exportDone, setExportDone] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress('正在导出……');
    try {
      await onExport();
      setExportProgress('导出完成！');
      setExportDone(true);
    } catch (err) {
      setExportProgress('导出失败');
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <div className="export-panel-inner">
        <div className="export-header">
          <h2 className="export-title">筛选完成</h2>
          <p className="export-subtitle">
            一共看了 <strong>{totalCount}</strong> 张照片
          </p>
        </div>

        <div className="export-stats">
          <div className="export-stat export-stat-selected">
            <div className="export-stat-num">{selectedCount}</div>
            <div className="export-stat-label">选中</div>
          </div>
          <div className="export-stat export-stat-maybe">
            <div className="export-stat-num">{maybeCount}</div>
            <div className="export-stat-label">再看看</div>
          </div>
          <div className="export-stat export-stat-rejected">
            <div className="export-stat-num">{rejectedCount}</div>
            <div className="export-stat-label">不要</div>
          </div>
        </div>

        {exportProgress && (
          <div className="export-progress">
            {exportProgress}
          </div>
        )}

        <div className="export-actions">
          {!exportDone && (
            <button
              className="export-btn export-btn-primary"
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0}
            >
              {isExporting ? '导出中...' : `导出选中的 ${selectedCount} 张`}
            </button>
          )}
          <button
            className="export-btn export-btn-secondary"
            onClick={onBack}
          >
            回去再看看
          </button>
        </div>

        {exportDone && (
          <div className="export-done-message">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2">
              <path d="M22,11.08V12a10,10,0,1,1-5.93-9.14" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
            <p>导出完成！可以在导出文件夹中找到照片。</p>
          </div>
        )}
      </div>
    </div>
  );
};
