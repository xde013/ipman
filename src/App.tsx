import { useState, useCallback } from 'react';
import { GridCanvas } from './components/GridCanvas';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import type { Region, Bounds, CanvasSize, GenerationContext, GeneratedComponent } from './types';
import { generateComponent, refineComponent } from './services/openai';
import './App.css';

function App() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 800, height: 600 });

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

  const handlePromptSubmit = useCallback(async (regionId: string, prompt: string) => {
    setPendingRegion(null);
    
    const regionWithPrompt: Region = {
      id: regionId,
      bounds: pendingRegion!.bounds,
      prompt,
      component: null,
      loading: true,
    };
    
    setRegions((prev) => [...prev, regionWithPrompt]);

    try {
      // Build full generation context
      const context: GenerationContext = {
        bounds: pendingRegion!.bounds,
        canvasSize,
        existingRegions: regions.map(r => ({ prompt: r.prompt, bounds: r.bounds })),
      };
      const component = await generateComponent(prompt, context);
      
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

  const handleCanvasSizeChange = useCallback((size: CanvasSize) => {
    setCanvasSize(size);
  }, []);

  const handleRegionDelete = useCallback((regionId: string) => {
    if (pendingRegion?.id === regionId) {
      setPendingRegion(null);
      return;
    }
    
    setRegions((prev) => prev.filter((r) => r.id !== regionId));
  }, [pendingRegion]);

  const handleRegionResize = useCallback((regionId: string, newBounds: Bounds) => {
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, bounds: newBounds } : r
      )
    );
  }, []);

  const handleComponentUpdate = useCallback((regionId: string, newComponent: GeneratedComponent) => {
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, component: newComponent } : r
      )
    );
  }, []);

  const handleRefine = useCallback(async (regionId: string, refinementPrompt: string) => {
    const region = regions.find((r) => r.id === regionId);
    if (!region?.component) return;

    // Set loading state
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, loading: true, error: undefined } : r
      )
    );

    try {
      const refinedComponent = await refineComponent(region.component, refinementPrompt);
      
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

  const handleClearAll = useCallback(() => {
    setRegions([]);
    setPendingRegion(null);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <Header showClearAll={regions.length > 0} onClearAll={handleClearAll} />
      
      <main className="flex-1 relative overflow-hidden">
        <GridCanvas
          regions={regions}
          pendingRegion={pendingRegion}
          onSelectionComplete={handleSelectionComplete}
          onPromptSubmit={handlePromptSubmit}
          onRegionDelete={handleRegionDelete}
          onRegionResize={handleRegionResize}
          onComponentUpdate={handleComponentUpdate}
          onRefine={handleRefine}
          onCanvasSizeChange={handleCanvasSizeChange}
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
