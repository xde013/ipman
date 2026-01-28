import OpenAI from 'openai';
import type { GeneratedComponent, GenerationContext, Bounds, CanvasSize } from '../../domain';
import type { IAIService } from '../../domain/interfaces';
import { GENERATE_SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT } from './prompts';

/**
 * OpenAI implementation of the AI service
 */
class OpenAIService implements IAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true, // For demo purposes - in production, use a backend
    });
  }

  async generateComponent(prompt: string, context?: GenerationContext): Promise<GeneratedComponent> {
    const userMessage = context 
      ? this.buildContextualPrompt(prompt, context)
      : prompt;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: GENERATE_SYSTEM_PROMPT },
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

      return this.parseComponent(parsed);
    } catch (error) {
      console.error('Error generating component:', error);
      throw error;
    }
  }

  async refineComponent(component: GeneratedComponent, refinement: string): Promise<GeneratedComponent> {
    const userMessage = `Current component:
${JSON.stringify(component, null, 2)}

Refinement request: ${refinement}`;

    try {
      const response = await this.client.chat.completions.create({
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

      return this.parseComponent(parsed);
    } catch (error) {
      console.error('Error refining component:', error);
      throw error;
    }
  }

  private buildContextualPrompt(prompt: string, context: GenerationContext): string {
    const { bounds, canvasSize, existingRegions } = context;
    const aspectRatio = (bounds.width / bounds.height).toFixed(2);
    const sizeCategory = bounds.width < 150 || bounds.height < 150 
      ? 'small' 
      : bounds.width > 400 || bounds.height > 400 
        ? 'large' 
        : 'medium';
    
    const positionDesc = this.getPositionDescription(bounds, canvasSize);
    const existingSummary = this.getExistingComponentsSummary(existingRegions, canvasSize);
    
    return `Container: ${Math.round(bounds.width)}px × ${Math.round(bounds.height)}px (aspect ratio: ${aspectRatio}, ${sizeCategory} size)
Position: ${positionDesc}${existingSummary}

Request: ${prompt}`;
  }

  private getPositionDescription(bounds: Bounds, canvas: CanvasSize): string {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    const horizontal = centerX < canvas.width * 0.3 ? 'left' 
      : centerX > canvas.width * 0.7 ? 'right' : 'center';
    const vertical = centerY < canvas.height * 0.25 ? 'top'
      : centerY > canvas.height * 0.75 ? 'bottom' : 'middle';
    
    if (vertical === 'top') return 'top area of canvas - typical location for headers, navbars, banners';
    if (vertical === 'bottom') return 'bottom area of canvas - typical location for footers, action bars';
    if (horizontal === 'left' && vertical === 'middle') return 'left side of canvas - typical location for sidebars, navigation';
    if (horizontal === 'right' && vertical === 'middle') return 'right side of canvas - typical location for sidebars, panels';
    return 'center area of canvas - typical location for main content';
  }

  private getExistingComponentsSummary(regions: Array<{ prompt: string; bounds: Bounds }>, canvas: CanvasSize): string {
    if (regions.length === 0) return '';
    
    const summaries = regions.map(region => {
      const position = this.getPositionDescription(region.bounds, canvas);
      const shortPosition = position.split(' - ')[0];
      return `- "${region.prompt}" at ${shortPosition}`;
    });
    
    return `\nExisting components on canvas:\n${summaries.join('\n')}`;
  }

  private parseComponent(data: Record<string, unknown>): GeneratedComponent {
    const component: GeneratedComponent = {
      element: data.element as string,
      className: data.className as string | undefined,
      props: data.props as Record<string, unknown> | undefined,
      content: data.content as string | undefined,
    };

    if (Array.isArray(data.children)) {
      component.children = data.children.map((child) => this.parseComponent(child as Record<string, unknown>));
    }

    return component;
  }
}

// Export singleton instance
export const aiService: IAIService = new OpenAIService();
