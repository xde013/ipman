import { useState, useCallback, useEffect } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import type { Region, Bounds, GeneratedComponent } from '../../domain';
import { DynamicComponent } from '../renderer';

interface RegionOverlayProps {
  region: Region;
  onDelete: () => void;
  onResize: (newBounds: Bounds) => void;
  onComponentUpdate?: (newComponent: GeneratedComponent) => void;
  onRefine?: (refinementPrompt: string) => void;
}

// Convert component JSON to JSX string
function componentToJSX(component: GeneratedComponent, indent = 0): string {
  const spaces = '  '.repeat(indent);
  const { element, className, props = {}, content, children } = component;
  
  // Build props string
  const allProps: string[] = [];
  if (className) {
    allProps.push(`className="${className}"`);
  }
  Object.entries(props).forEach(([key, value]) => {
    if (typeof value === 'string') {
      allProps.push(`${key}="${value}"`);
    } else if (typeof value === 'number') {
      allProps.push(`${key}={${value}}`);
    } else if (typeof value === 'boolean') {
      allProps.push(value ? key : `${key}={false}`);
    }
  });
  
  const propsStr = allProps.length > 0 ? ' ' + allProps.join(' ') : '';
  
  // Self-closing elements without children or content
  const hasChildren = children && children.length > 0;
  const hasContent = content && content.trim().length > 0;
  
  if (!hasChildren && !hasContent) {
    return `${spaces}<${element}${propsStr} />`;
  }
  
  // Element with content only
  if (!hasChildren && hasContent) {
    // Short content on same line
    if (content.length < 40 && !content.includes('\n')) {
      return `${spaces}<${element}${propsStr}>${content}</${element}>`;
    }
    // Longer content on new line
    return `${spaces}<${element}${propsStr}>\n${spaces}  ${content}\n${spaces}</${element}>`;
  }
  
  // Element with children
  const childrenJSX = children!
    .map(child => componentToJSX(child, indent + 1))
    .join('\n');
  
  if (hasContent) {
    return `${spaces}<${element}${propsStr}>\n${spaces}  ${content}\n${childrenJSX}\n${spaces}</${element}>`;
  }
  
  return `${spaces}<${element}${propsStr}>\n${childrenJSX}\n${spaces}</${element}>`;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface ResizeState {
  handle: ResizeHandle;
  startX: number;
  startY: number;
  startBounds: Bounds;
}

interface DragState {
  startX: number;
  startY: number;
  startBounds: Bounds;
}

const MIN_SIZE = 50;

export function RegionOverlay({ region, onDelete, onResize, onComponentUpdate, onRefine }: RegionOverlayProps) {
  const { bounds, component, loading, error, prompt } = region;
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Local bounds for smooth visual feedback during resize/drag
  const [localBounds, setLocalBounds] = useState<Bounds | null>(null);
  // Toggle between component view and code view
  const [showCode, setShowCode] = useState(false);
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  // Refine mode state
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  
  // Use local bounds during resize/drag, otherwise use region bounds
  const displayBounds = localBounds ?? bounds;
  
  // Track if we're currently interacting (resizing or dragging)
  const isInteracting = resizeState !== null || dragState !== null;
  
  // Track if in any input mode
  const isInInputMode = isEditing || isRefining;

  // Enter edit mode
  const handleStartEdit = useCallback(() => {
    if (component) {
      setEditedCode(JSON.stringify(component, null, 2));
      setIsEditing(true);
      setEditError(null);
    }
  }, [component]);

  // Save edited component
  const handleSaveEdit = useCallback(() => {
    try {
      const parsed = JSON.parse(editedCode);
      // Basic validation
      if (!parsed.element || typeof parsed.element !== 'string') {
        throw new Error('Missing or invalid "element" field');
      }
      onComponentUpdate?.(parsed);
      setIsEditing(false);
      setEditError(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [editedCode, onComponentUpdate]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
    setEditedCode('');
  }, []);

  // Enter refine mode
  const handleStartRefine = useCallback(() => {
    setIsRefining(true);
    setRefinePrompt('');
  }, []);

  // Submit refinement
  const handleSubmitRefine = useCallback(() => {
    if (refinePrompt.trim() && onRefine) {
      onRefine(refinePrompt.trim());
      setIsRefining(false);
      setRefinePrompt('');
    }
  }, [refinePrompt, onRefine]);

  // Cancel refine
  const handleCancelRefine = useCallback(() => {
    setIsRefining(false);
    setRefinePrompt('');
  }, []);

  // Start dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't start drag if in any input mode
    if (isInInputMode) return;
    
    e.preventDefault();
    setDragState({
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { ...bounds },
    });
    setLocalBounds({ ...bounds });
  }, [bounds, isInInputMode]);

  // Handle drag movement
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      const newBounds = {
        ...dragState.startBounds,
        x: dragState.startBounds.x + deltaX,
        y: dragState.startBounds.y + deltaY,
      };

      setLocalBounds(newBounds);
    };

    const handleMouseUp = () => {
      if (localBounds) {
        onResize(localBounds);
      }
      setDragState(null);
      setLocalBounds(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, localBounds, onResize]);

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    
    setResizeState({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { ...bounds },
    });
    setLocalBounds({ ...bounds });
  }, [bounds]);

  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      const { handle, startBounds } = resizeState;

      const newBounds = { ...startBounds };

      // Handle horizontal resize
      if (handle.includes('e')) {
        newBounds.width = Math.max(MIN_SIZE, startBounds.width + deltaX);
      }
      if (handle.includes('w')) {
        const newWidth = Math.max(MIN_SIZE, startBounds.width - deltaX);
        const widthDiff = startBounds.width - newWidth;
        newBounds.x = startBounds.x + widthDiff;
        newBounds.width = newWidth;
      }

      // Handle vertical resize
      if (handle.includes('s')) {
        newBounds.height = Math.max(MIN_SIZE, startBounds.height + deltaY);
      }
      if (handle.includes('n')) {
        const newHeight = Math.max(MIN_SIZE, startBounds.height - deltaY);
        const heightDiff = startBounds.height - newHeight;
        newBounds.y = startBounds.y + heightDiff;
        newBounds.height = newHeight;
      }

      // Only update local state during drag - no parent re-render
      setLocalBounds(newBounds);
    };

    const handleMouseUp = () => {
      // Commit final bounds to parent only on mouseup
      if (localBounds) {
        onResize(localBounds);
      }
      setResizeState(null);
      setLocalBounds(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, localBounds, onResize]);

  const handleCursor: Record<ResizeHandle, string> = {
    n: 'cursor-ns-resize',
    s: 'cursor-ns-resize',
    e: 'cursor-ew-resize',
    w: 'cursor-ew-resize',
    ne: 'cursor-nesw-resize',
    sw: 'cursor-nesw-resize',
    nw: 'cursor-nwse-resize',
    se: 'cursor-nwse-resize',
  };

  return (
    <div
      className={`region-overlay group absolute bg-white border-2 border-gray-200 rounded-lg shadow-md overflow-hidden hover:border-indigo-500 hover:shadow-lg ${isInteracting ? 'border-indigo-500 shadow-lg' : ''} ${dragState ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: displayBounds.x,
        top: displayBounds.y,
        width: displayBounds.width,
        height: displayBounds.height,
      }}
      onMouseDown={handleDragStart}
    >
      {/* Action buttons */}
      <div 
        className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Toggle code button */}
        {component && !loading && !error && !isInInputMode && (
          <button
            className={`w-6 h-6 text-xs leading-none bg-white border border-gray-200 rounded-full transition-all ${
              showCode 
                ? 'text-indigo-500 border-indigo-500' 
                : 'text-gray-400 hover:text-indigo-500 hover:border-indigo-500'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setShowCode(!showCode);
            }}
            title={showCode ? 'Show component' : 'Show code'}
          >
            {showCode ? '◉' : '</>'}
          </button>
        )}
        {/* Refine button */}
        {component && !loading && !error && !isInInputMode && onRefine && (
          <button
            className="w-6 h-6 text-xs leading-none text-gray-400 bg-white border border-gray-200 rounded-full transition-all hover:text-indigo-500 hover:border-indigo-500"
            onClick={(e) => {
              e.stopPropagation();
              handleStartRefine();
            }}
            title="Refine with AI"
          >
            ✨
          </button>
        )}
        {/* Edit button */}
        {component && !loading && !error && !isInInputMode && onComponentUpdate && (
          <button
            className="w-6 h-6 text-xs leading-none text-gray-400 bg-white border border-gray-200 rounded-full transition-all hover:text-indigo-500 hover:border-indigo-500"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            title="Edit JSON"
          >
            ✎
          </button>
        )}
        {/* Delete button */}
        {!isInInputMode && (
          <button
            className="w-6 h-6 text-lg leading-none text-gray-400 bg-white border border-gray-200 rounded-full transition-all hover:text-white hover:bg-red-500 hover:border-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete region"
          >
            ×
          </button>
        )}
      </div>

      {/* Resize handles */}
      {/* Corner handles */}
      <div
        className={`absolute -top-1 -left-1 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.nw}`}
        onMouseDown={(e) => handleResizeStart(e, 'nw')}
      />
      <div
        className={`absolute -top-1 -right-1 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.ne}`}
        onMouseDown={(e) => handleResizeStart(e, 'ne')}
      />
      <div
        className={`absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.sw}`}
        onMouseDown={(e) => handleResizeStart(e, 'sw')}
      />
      <div
        className={`absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.se}`}
        onMouseDown={(e) => handleResizeStart(e, 'se')}
      />

      {/* Edge handles */}
      <div
        className={`absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.n}`}
        onMouseDown={(e) => handleResizeStart(e, 'n')}
      />
      <div
        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.s}`}
        onMouseDown={(e) => handleResizeStart(e, 's')}
      />
      <div
        className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.w}`}
        onMouseDown={(e) => handleResizeStart(e, 'w')}
      />
      <div
        className={`absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white border-2 border-indigo-500 rounded-sm opacity-0 group-hover:opacity-100 z-20 ${handleCursor.e}`}
        onMouseDown={(e) => handleResizeStart(e, 'e')}
      />

      {/* Region content */}
      {loading && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Generating...</span>
        </div>
      )}

      {error && (
        <div className="w-full h-full flex items-center justify-center gap-2 text-red-500 text-sm p-4">
          <span className="text-xl">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {component && !loading && !error && (
        <div className="w-full h-full overflow-auto">
          {isEditing ? (
            // Edit mode
            <div className="w-full h-full flex flex-col">
              <textarea
                className="flex-1 w-full p-3 text-xs font-mono bg-gray-50 border-0 resize-none focus:outline-none focus:ring-0"
                value={editedCode}
                onChange={(e) => {
                  setEditedCode(e.target.value);
                  setEditError(null);
                }}
                onClick={(e) => e.stopPropagation()}
                spellCheck={false}
              />
              {editError && (
                <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200">
                  Error: {editError}
                </div>
              )}
              <div className="flex gap-2 p-2 border-t border-gray-200 bg-gray-50">
                <button
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 rounded hover:bg-indigo-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                >
                  Save
                </button>
                <button
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : isRefining ? (
            // Refine mode - show component with input overlay
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 overflow-auto opacity-50">
                <DynamicComponent component={component} />
              </div>
              <div 
                className="p-3 border-t border-gray-200 bg-white"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Describe changes (e.g., 'make it blue', 'add a subtitle')"
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && refinePrompt.trim()) {
                        handleSubmitRefine();
                      } else if (e.key === 'Escape') {
                        handleCancelRefine();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSubmitRefine}
                    disabled={!refinePrompt.trim()}
                  >
                    Refine
                  </button>
                  <button
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    onClick={handleCancelRefine}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ) : showCode ? (
            // Code view (read-only)
            <Highlight theme={themes.vsLight} code={componentToJSX(component)} language="jsx">
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre 
                  className="w-full h-full p-4 text-xs overflow-auto font-mono m-0"
                  style={{ ...style, background: '#fafafa' }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          ) : (
            // Component view
            <DynamicComponent component={component} />
          )}
        </div>
      )}

      {/* Prompt tooltip on hover */}
      {prompt && (
        <div className="absolute bottom-full left-0 right-0 px-3 py-2 text-xs text-white bg-gray-900/95 rounded-md opacity-0 group-hover:opacity-100 translate-y-1 group-hover:-translate-y-1 transition-all pointer-events-none truncate z-20">
          <span className="font-semibold text-indigo-400">Prompt:</span> {prompt}
        </div>
      )}
    </div>
  );
}
