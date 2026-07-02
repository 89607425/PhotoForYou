import React, { useEffect, useRef, useState } from 'react';
import type { ScoredPhoto, ReviewAction } from '../types';
import { useGesture, type SwipeState } from '../hooks/useGesture';
import { ScorePanel } from './ScorePanel';

interface PhotoViewerProps {
  photo: ScoredPhoto;
  onSwipe: (action: ReviewAction) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number;
  currentIndex: number;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photo,
  onSwipe,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  totalCount,
  currentIndex,
}) => {
  const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, swipeState } = useGesture();
  const prevSwipeRef = useRef<SwipeState>({ direction: null, progress: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [photo.mediumUrl]);

  useEffect(() => {
    const prev = prevSwipeRef.current;
    const curr = swipeState;
    if (prev.progress >= 0.8 && prev.direction && curr.progress === 0 && curr.direction === null) {
      if (prev.direction === 'right') onSwipe('select');
      else if (prev.direction === 'left') onSwipe('reject');
      else if (prev.direction === 'up') onSwipe('maybe');
    }
    prevSwipeRef.current = curr;
  }, [swipeState, onSwipe]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); if (hasPrev) onPrev(); break;
        case 'ArrowRight': e.preventDefault(); if (hasNext) onNext(); break;
        case 'q': case 'Q': e.preventDefault(); onSwipe('select'); break;
        case 'w': case 'W': e.preventDefault(); onSwipe('reject'); break;
        case 'e': case 'E': e.preventDefault(); onSwipe('maybe'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onSwipe]);

  const getTransform = (): React.CSSProperties => {
    if (!swipeState.direction || swipeState.progress === 0) return { transform: 'translateX(0) translateY(0) rotate(0deg)', opacity: 1 };
    const maxOffset = 150;
    const offset = swipeState.progress * maxOffset;
    const rotation = swipeState.progress * 5;
    switch (swipeState.direction) {
      case 'left': return { transform: `translateX(-${offset}px) rotate(-${rotation}deg)`, opacity: Math.max(0, 1 - swipeState.progress) };
      case 'right': return { transform: `translateX(${offset}px) rotate(${rotation}deg)`, opacity: Math.max(0, 1 - swipeState.progress) };
      case 'up': return { transform: `translateY(-${offset}px)`, opacity: Math.max(0, 1 - swipeState.progress) };
      default: return { transform: 'translateX(0) translateY(0) rotate(0deg)', opacity: 1 };
    }
  };

  const getSwipeIndicatorClass = (): string => {
    if (!swipeState.direction || swipeState.progress < 0.3) return '';
    switch (swipeState.direction) {
      case 'left': return 'swipe-indicator-reject';
      case 'right': return 'swipe-indicator-select';
      case 'up': return 'swipe-indicator-maybe';
      default: return '';
    }
  };

  const displaySrc = photo.mediumUrl || photo.thumbnailUrl;

  return (
    <div className="photo-viewer">
      <div className="photo-viewer-main-area">
        <div className={`photo-viewer-stage ${getSwipeIndicatorClass()}`}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
          <img src={displaySrc}
            alt={photo.name} className={`photo-viewer-image ${imageLoaded ? 'loaded' : ''}`}
            style={getTransform()} onLoad={() => setImageLoaded(true)} draggable={false} />

          {swipeState.direction && swipeState.progress > 0.3 && (
            <div className={`swipe-overlay swipe-overlay-${swipeState.direction}`}>
              <span className="swipe-label">
                {swipeState.direction === 'right' && '\u2714 要这张'}
                {swipeState.direction === 'left' && '\u2718 不要'}
                {swipeState.direction === 'up' && '\u2B06 再看看'}
              </span>
            </div>
          )}

          {hasPrev && (
            <button className="photo-nav photo-nav-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="上一张">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button className="photo-nav photo-nav-next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="下一张">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </button>
          )}

          <div className="photo-counter">{currentIndex + 1} / {totalCount}</div>

          {!imageLoaded && (
            <img src={photo.thumbnailUrl} alt="" className="photo-viewer-thumb" draggable={false} />
          )}

          <div className="photo-name-overlay">{photo.name}</div>
        </div>
        <ScorePanel photo={photo} />
      </div>

      <div className="action-bar">
        <button className="action-btn action-btn-reject" onClick={() => onSwipe('reject')} title="不要 (W)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>不要</span>
        </button>
        <button className="action-btn action-btn-maybe" onClick={() => onSwipe('maybe')} title="再看看 (E)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19,12 12,19 5,12" />
          </svg>
          <span>再看看</span>
        </button>
        <button className="action-btn action-btn-select" onClick={() => onSwipe('select')} title="要这张 (Q)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20,6 9,17 4,12" />
          </svg>
          <span>要这张</span>
        </button>
      </div>
    </div>
  );
};
