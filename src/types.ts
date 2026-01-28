export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeneratedComponent {
  element: string;  // Any HTML element: div, form, input, button, img, h1-h6, p, span, ul, li, etc.
  className?: string;
  props?: Record<string, unknown>;  // Any valid HTML props: placeholder, type, src, alt, href, etc.
  content?: string;  // Text content
  children?: GeneratedComponent[];  // Nested children for complex layouts
}

export interface Region {
  id: string;
  bounds: Bounds;
  prompt: string;
  component: GeneratedComponent | null;
  loading: boolean;
  error?: string;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface GenerationContext {
  bounds: Bounds;
  canvasSize: CanvasSize;
  existingRegions: Array<{ prompt: string; bounds: Bounds }>;
}
