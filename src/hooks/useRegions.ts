import { useState, useCallback } from 'react';
import type { Region, Bounds, CanvasSize, GenerationContext, GeneratedComponent } from '../domain';
import { aiService } from '../services';

/**
 * Hook for managing regions and AI component generation
 */
export function useRegions(canvasSize: CanvasSize) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);

  // Create a new pending region from selection bounds
  const handleSelectionComplete = useCallback((bounds: Bounds) => {
    const newRegion: Region = {
      id: `region-${Date.now()}`,
      bounds,
      prompt: '',
      component: null,
      loading: false,
    };
    setPendingRegion(newRegion);
  }, []);

  // Submit prompt and generate component
  const handlePromptSubmit = useCallback(async (regionId: string, prompt: string) => {
    if (!pendingRegion) return;
    
    setPendingRegion(null);
    
    const regionWithPrompt: Region = {
      id: regionId,
      bounds: pendingRegion.bounds,
      prompt,
      component: null,
      loading: true,
    };
    
    setRegions((prev) => [...prev, regionWithPrompt]);

    try {
      const context: GenerationContext = {
        bounds: pendingRegion.bounds,
        canvasSize,
        existingRegions: regions.map(r => ({ prompt: r.prompt, bounds: r.bounds })),
      };
      const component = await aiService.generateComponent(prompt, context);
      
      setRegions((prev) =>
        prev.map((r) =>
          r.id === regionId
            ? { ...r, component, loading: false }
            : r
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate component';
      
      setRegions((prev) =>
        prev.map((r) =>
          r.id === regionId
            ? { ...r, loading: false, error: errorMessage }
            : r
        )
      );
    }
  }, [pendingRegion, canvasSize, regions]);

  // Delete a region
  const handleRegionDelete = useCallback((regionId: string) => {
    if (pendingRegion?.id === regionId) {
      setPendingRegion(null);
      return;
    }
    
    setRegions((prev) => prev.filter((r) => r.id !== regionId));
  }, [pendingRegion]);

  // Resize a region
  const handleRegionResize = useCallback((regionId: string, newBounds: Bounds) => {
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, bounds: newBounds } : r
      )
    );
  }, []);

  // Update a component directly (from JSON editor)
  const handleComponentUpdate = useCallback((regionId: string, newComponent: GeneratedComponent) => {
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, component: newComponent } : r
      )
    );
  }, []);

  // Refine a component with AI
  const handleRefine = useCallback(async (regionId: string, refinementPrompt: string) => {
    const region = regions.find((r) => r.id === regionId);
    if (!region?.component) return;

    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, loading: true, error: undefined } : r
      )
    );

    try {
      const refinedComponent = await aiService.refineComponent(region.component, refinementPrompt);
      
      setRegions((prev) =>
        prev.map((r) =>
          r.id === regionId
            ? { ...r, component: refinedComponent, loading: false }
            : r
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refine component';
      
      setRegions((prev) =>
        prev.map((r) =>
          r.id === regionId
            ? { ...r, loading: false, error: errorMessage }
            : r
        )
      );
    }
  }, [regions]);

  // Clear all regions
  const handleClearAll = useCallback(() => {
    setRegions([]);
    setPendingRegion(null);
  }, []);

  return {
    // State
    regions,
    pendingRegion,
    hasRegions: regions.length > 0,
    
    // Actions
    onSelectionComplete: handleSelectionComplete,
    onPromptSubmit: handlePromptSubmit,
    onRegionDelete: handleRegionDelete,
    onRegionResize: handleRegionResize,
    onComponentUpdate: handleComponentUpdate,
    onRefine: handleRefine,
    clearAll: handleClearAll,
  };
}
