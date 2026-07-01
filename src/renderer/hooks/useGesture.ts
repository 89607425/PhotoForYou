import { useState, useRef, useCallback } from 'react';

export interface SwipeState {
  direction: 'left' | 'right' | 'up' | null;
  progress: number;
}

export interface UseGestureReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  swipeState: SwipeState;
}

const SWIPE_THRESHOLD = 80;

export function useGesture(): UseGestureReturn {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    direction: null,
    progress: 0,
  });

  const trackingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  const updateSwipeState = useCallback(() => {
    const dx = currentRef.current.x - startRef.current.x;
    const dy = currentRef.current.y - startRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 10 && absDy < 10) {
      setSwipeState({ direction: null, progress: 0 });
      return;
    }

    let direction: 'left' | 'right' | 'up';
    let rawProgress: number;

    if (absDx > absDy) {
      // Horizontal swipe
      direction = dx < 0 ? 'left' : 'right';
      rawProgress = Math.min(absDx / SWIPE_THRESHOLD, 1);
    } else {
      // Vertical swipe
      direction = 'up';
      rawProgress = Math.min(absDy / SWIPE_THRESHOLD, 1);
    }

    setSwipeState({ direction, progress: rawProgress });
  }, []);

  const handleStart = useCallback(
    (x: number, y: number) => {
      trackingRef.current = true;
      startRef.current = { x, y };
      currentRef.current = { x, y };
      setSwipeState({ direction: null, progress: 0 });
    },
    []
  );

  const handleMove = useCallback(
    (x: number, y: number) => {
      if (!trackingRef.current) return;
      currentRef.current = { x, y };
      updateSwipeState();
    },
    [updateSwipeState]
  );

  const handleEnd = useCallback(() => {
    trackingRef.current = false;
    setSwipeState({ direction: null, progress: 0 });
  }, []);

  // Touch handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      handleEnd();
    },
    [handleEnd]
  );

  // Mouse handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      handleEnd();
    },
    [handleEnd]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    swipeState,
  };
}
