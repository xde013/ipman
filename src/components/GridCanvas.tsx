import { useRef, useState, useCallback, useEffect } from 'react';
import { useMouse } from 'react-use';
import type { Region, Bounds, CanvasSize, GeneratedComponent } from '../types';
import { RegionOverlay } from './RegionOverlay';
import { PromptInput } from './PromptInput';

const MIN_SELECTION_SIZE = 50;

interface GridCanvasProps {
  regions: Region[];
  onSelectionComplete: (bounds: Bounds) => void;
  onPromptSubmit: (regionId: string, prompt: string) => void;
  onRegionDelete: (regionId: string) => void;
  onRegionResize: (regionId: string, newBounds: Bounds) => void;
  onComponentUpdate: (regionId: string, newComponent: GeneratedComponent) => void;
  onRefine: (regionId: string, refinementPrompt: string) => void;
  onCanvasSizeChange?: (size: CanvasSize) => void;
  pendingRegion: Region | null;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
}

export function GridCanvas({
  regions,
  onSelectionComplete,
  onPromptSubmit,
  onRegionDelete,
  onRegionResize,
  onComponentUpdate,
  onRefine,
  onCanvasSizeChange,
  pendingRegion,
}: GridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  // Use react-use's useMouse hook for tracking mouse position
  const mouse = useMouse(containerRef);

  // Track canvas size and report to parent
  useEffect(() => {
    if (!containerRef.current || !onCanvasSizeChange) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        onCanvasSizeChange({ width, height });
      }
    };
    
    // Initial size
    updateSize();
    
    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [onCanvasSizeChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('.region-overlay') || target.closest('.prompt-input')) {
      return;
    }

    setDragState({
      isDragging: true,
      startX: mouse.elX,
      startY: mouse.elY,
    });
  }, [mouse.elX, mouse.elY]);

  const handleMouseUp = useCallback(() => {
    if (!dragState?.isDragging) return;

    const x = Math.min(dragState.startX, mouse.elX);
    const y = Math.min(dragState.startY, mouse.elY);
    const width = Math.abs(mouse.elX - dragState.startX);
    const height = Math.abs(mouse.elY - dragState.startY);

    if (width >= MIN_SELECTION_SIZE && height >= MIN_SELECTION_SIZE) {
      onSelectionComplete({ x, y, width, height });
    }

    setDragState(null);
  }, [dragState, mouse.elX, mouse.elY, onSelectionComplete]);

  // Calculate selection bounds
  const selectionBounds = dragState?.isDragging ? {
    x: Math.min(dragState.startX, mouse.elX),
    y: Math.min(dragState.startY, mouse.elY),
    width: Math.abs(mouse.elX - dragState.startX),
    height: Math.abs(mouse.elY - dragState.startY),
    isValid: Math.abs(mouse.elX - dragState.startX) >= MIN_SELECTION_SIZE && 
             Math.abs(mouse.elY - dragState.startY) >= MIN_SELECTION_SIZE,
  } : null;

  const isSelecting = dragState?.isDragging ?? false;

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full bg-white cursor-crosshair overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid background pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Selection rectangle while dragging */}
      {isSelecting && selectionBounds && (
        <div
          className={`absolute border-2 border-dashed pointer-events-none z-50 flex items-center justify-center transition-colors duration-150 ${
            selectionBounds.isValid 
              ? 'border-green-500 bg-green-500/10' 
              : 'border-gray-400 bg-gray-400/10'
          }`}
          style={{
            left: selectionBounds.x,
            top: selectionBounds.y,
            width: selectionBounds.width,
            height: selectionBounds.height,
          }}
        >
          {!selectionBounds.isValid && (
            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
              Keep dragging...
            </span>
          )}
        </div>
      )}

      {/* Pending region selection box */}
      {pendingRegion && (
        <div
          className="region-overlay absolute border-2 border-dashed border-indigo-500 rounded-lg bg-indigo-500/5 z-40"
          style={{
            left: pendingRegion.bounds.x,
            top: pendingRegion.bounds.y,
            width: pendingRegion.bounds.width,
            height: pendingRegion.bounds.height,
          }}
        />
      )}

      {/* Prompt input positioned to the right of pending region */}
      {pendingRegion && (
        <div
          className="prompt-input absolute z-50"
          style={{
            left: pendingRegion.bounds.x + pendingRegion.bounds.width + 12,
            top: pendingRegion.bounds.y,
          }}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80">
            <PromptInput
              onSubmit={(prompt) => onPromptSubmit(pendingRegion.id, prompt)}
              onCancel={() => onRegionDelete(pendingRegion.id)}
            />
          </div>
        </div>
      )}

      {/* Rendered regions */}
      {regions.map((region) => (
        <RegionOverlay
          key={region.id}
          region={region}
          onDelete={() => onRegionDelete(region.id)}
          onResize={(newBounds) => onRegionResize(region.id, newBounds)}
          onComponentUpdate={(newComponent) => onComponentUpdate(region.id, newComponent)}
          onRefine={(refinementPrompt) => onRefine(region.id, refinementPrompt)}
        />
      ))}

      {/* Instructions overlay when empty */}
      {regions.length === 0 && !pendingRegion && !isSelecting && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
          <h2 className="text-2xl font-semibold text-gray-400 mb-2">
            Drag to create a region
          </h2>
          <p className="text-gray-400/70">
            Select an area, then describe the UI you want
          </p>
        </div>
      )}
    </div>
  );
}
