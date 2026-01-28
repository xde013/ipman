import { useState, useCallback } from 'react';
import type { CanvasSize } from '../domain';

/**
 * Hook for managing canvas state
 */
export function useCanvas() {
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 800, height: 600 });

  const handleCanvasSizeChange = useCallback((size: CanvasSize) => {
    setCanvasSize(size);
  }, []);

  return {
    canvasSize,
    onCanvasSizeChange: handleCanvasSizeChange,
  };
}
