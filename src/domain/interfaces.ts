import type { GeneratedComponent, GenerationContext } from './entities';

/**
 * Service contracts/interfaces for the application
 */

/** AI service interface for component generation */
export interface IAIService {
  /** Generate a new component from a prompt */
  generateComponent(prompt: string, context?: GenerationContext): Promise<GeneratedComponent>;
  
  /** Refine an existing component based on instructions */
  refineComponent(component: GeneratedComponent, refinement: string): Promise<GeneratedComponent>;
}
