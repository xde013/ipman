import { Header, Footer, GridCanvas } from './components';
import { useCanvas, useRegions } from './hooks';
import './App.css';

function App() {
  const canvas = useCanvas();
  const regions = useRegions(canvas.canvasSize);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <Header showClearAll={regions.hasRegions} onClearAll={regions.clearAll} />
      
      <main className="flex-1 relative overflow-hidden">
        <GridCanvas
          regions={regions.regions}
          pendingRegion={regions.pendingRegion}
          onSelectionComplete={regions.onSelectionComplete}
          onPromptSubmit={regions.onPromptSubmit}
          onRegionDelete={regions.onRegionDelete}
          onRegionResize={regions.onRegionResize}
          onComponentUpdate={regions.onComponentUpdate}
          onRefine={regions.onRefine}
          onCanvasSizeChange={canvas.onCanvasSizeChange}
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
