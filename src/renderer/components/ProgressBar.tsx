import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  text: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, text }) => {
  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="progress-bar-text">{text}</p>
    </div>
  );
};
