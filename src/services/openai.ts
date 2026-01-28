import OpenAI from 'openai';
import type { GeneratedComponent, Bounds, CanvasSize, GenerationContext } from '../types';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // For demo purposes - in production, use a backend
});

// Helper: Get position description based on region location on canvas
function getPositionDescription(bounds: Bounds, canvas: CanvasSize): string {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  
  const horizontal = centerX < canvas.width * 0.3 ? 'left' 
    : centerX > canvas.width * 0.7 ? 'right' : 'center';
  const vertical = centerY < canvas.height * 0.25 ? 'top'
    : centerY > canvas.height * 0.75 ? 'bottom' : 'middle';
  
  // Return semantic description
  if (vertical === 'top') return 'top area of canvas - typical location for headers, navbars, banners';
  if (vertical === 'bottom') return 'bottom area of canvas - typical location for footers, action bars';
  if (horizontal === 'left' && vertical === 'middle') return 'left side of canvas - typical location for sidebars, navigation';
  if (horizontal === 'right' && vertical === 'middle') return 'right side of canvas - typical location for sidebars, panels';
  return 'center area of canvas - typical location for main content';
}

// Helper: Summarize existing components on canvas
function getExistingComponentsSummary(regions: Array<{ prompt: string; bounds: Bounds }>, canvas: CanvasSize): string {
  if (regions.length === 0) return '';
  
  const summaries = regions.map(region => {
    const position = getPositionDescription(region.bounds, canvas);
    const shortPosition = position.split(' - ')[0]; // Just "top area of canvas" part
    return `- "${region.prompt}" at ${shortPosition}`;
  });
  
  return `\nExisting components on canvas:\n${summaries.join('\n')}`;
}

const SYSTEM_PROMPT = `You are a UI component generator. Return a JSON object describing HTML elements with Tailwind CSS.

RULES:
- CRITICAL: Root element MUST fill entire container with NO margin, padding, or centering. w-full h-full is auto-applied.
- Root background should match the component (not transparent) - users want visual components that fill the space.
- Use semantic HTML: <header>, <nav>, <main>, <aside>, <footer>, <form>, <section>.
- Adapt layout to container shape: wide→horizontal flex, tall→vertical flex.
- Components should fill their entire container, edge to edge.

SCHEMA:
{ "element": "div|form|nav|header|footer|aside|button|input|...", "className": "tailwind classes", "props": { "placeholder": "...", "type": "...", "href": "..." }, "content": "text", "children": [...] }

EXAMPLES:

1. Navbar (fills entire container):
{ "element": "header", "className": "flex items-center justify-between px-6 bg-gray-900", "children": [
  { "element": "span", "className": "text-xl font-bold text-white", "content": "Logo" },
  { "element": "nav", "className": "flex gap-6", "children": [
    { "element": "a", "className": "text-gray-300 hover:text-white", "props": { "href": "#" }, "content": "Home" },
    { "element": "a", "className": "text-gray-300 hover:text-white", "props": { "href": "#" }, "content": "About" }
  ]}
]}

2. Sidebar (fills entire container):
{ "element": "aside", "className": "flex flex-col gap-2 p-4 bg-gray-100", "children": [
  { "element": "h3", "className": "text-sm font-semibold text-gray-500 uppercase mb-2", "content": "Menu" },
  { "element": "a", "className": "px-3 py-2 rounded-lg bg-indigo-500 text-white", "props": { "href": "#" }, "content": "Dashboard" },
  { "element": "a", "className": "px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-200", "props": { "href": "#" }, "content": "Settings" }
]}

3. Form (fills entire container):
{ "element": "form", "className": "flex flex-col gap-4 p-6 bg-white", "children": [
  { "element": "h2", "className": "text-2xl font-bold text-gray-900", "content": "Sign In" },
  { "element": "input", "className": "w-full px-4 py-2 border border-gray-300 rounded-lg", "props": { "type": "email", "placeholder": "Email" } },
  { "element": "input", "className": "w-full px-4 py-2 border border-gray-300 rounded-lg", "props": { "type": "password", "placeholder": "Password" } },
  { "element": "button", "className": "bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-lg", "content": "Sign In" }
]}

4. Button (fills entire container):
{ "element": "button", "className": "bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md", "content": "Delete" }

Return ONLY valid JSON.`;

export async function generateComponent(prompt: string, context?: GenerationContext): Promise<GeneratedComponent> {
  // Build user message with full context if available
  let userMessage = prompt;
  
  if (context) {
    const { bounds, canvasSize, existingRegions } = context;
    const aspectRatio = (bounds.width / bounds.height).toFixed(2);
    const sizeCategory = bounds.width < 150 || bounds.height < 150 
      ? 'small' 
      : bounds.width > 400 || bounds.height > 400 
        ? 'large' 
        : 'medium';
    
    const positionDesc = getPositionDescription(bounds, canvasSize);
    const existingSummary = getExistingComponentsSummary(existingRegions, canvasSize);
    
    userMessage = `Container: ${Math.round(bounds.width)}px × ${Math.round(bounds.height)}px (aspect ratio: ${aspectRatio}, ${sizeCategory} size)
Position: ${positionDesc}${existingSummary}

Request: ${prompt}`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    // Validate minimum structure
    if (!parsed.element || typeof parsed.element !== 'string') {
      throw new Error('Invalid component: missing element type');
    }

    return parseComponent(parsed);
  } catch (error) {
    console.error('Error generating component:', error);
    throw error;
  }
}

function parseComponent(data: Record<string, unknown>): GeneratedComponent {
  const component: GeneratedComponent = {
    element: data.element as string,
    className: data.className as string | undefined,
    props: data.props as Record<string, unknown> | undefined,
    content: data.content as string | undefined,
  };

  if (Array.isArray(data.children)) {
    component.children = data.children.map((child) => parseComponent(child as Record<string, unknown>));
  }

  return component;
}

const REFINE_SYSTEM_PROMPT = `You are a UI component modifier. You receive an existing component (JSON) and a refinement request. Return the modified component as JSON.

RULES:
- Preserve the overall structure unless the user asks for major changes.
- Apply Tailwind CSS changes as requested.
- Keep the root element filling its container (w-full h-full will be auto-applied).
- Return the complete modified component, not just the changes.

Return ONLY valid JSON matching the schema:
{ "element": "...", "className": "tailwind classes", "props": { ... }, "content": "text", "children": [...] }`;

export async function refineComponent(
  currentComponent: GeneratedComponent,
  refinementPrompt: string
): Promise<GeneratedComponent> {
  const userMessage = `Current component:
${JSON.stringify(currentComponent, null, 2)}

Refinement request: ${refinementPrompt}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: REFINE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    if (!parsed.element || typeof parsed.element !== 'string') {
      throw new Error('Invalid component: missing element type');
    }

    return parseComponent(parsed);
  } catch (error) {
    console.error('Error refining component:', error);
    throw error;
  }
}
