/**
 * Core domain entities for the UI Builder application
 */

/** Represents a rectangular area with position and dimensions */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Represents a generated UI component structure */
export interface GeneratedComponent {
  /** HTML element type: div, form, input, button, img, h1-h6, p, span, ul, li, etc. */
  element: string;
  /** Tailwind CSS classes */
  className?: string;
  /** HTML props: placeholder, type, src, alt, href, etc. */
  props?: Record<string, unknown>;
  /** Text content */
  content?: string;
  /** Nested children for complex layouts */
  children?: GeneratedComponent[];
}

/** Represents a region on the canvas with its component */
export interface Region {
  id: string;
  bounds: Bounds;
  prompt: string;
  component: GeneratedComponent | null;
  loading: boolean;
  error?: string;
}

/** Canvas dimensions */
export interface CanvasSize {
  width: number;
  height: number;
}

/** Context provided to AI for component generation */
export interface GenerationContext {
  bounds: Bounds;
  canvasSize: CanvasSize;
  existingRegions: Array<{ prompt: string; bounds: Bounds }>;
}
