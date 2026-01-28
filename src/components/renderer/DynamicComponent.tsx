import { createElement } from 'react';
import type { GeneratedComponent } from '../../domain';

interface DynamicComponentProps {
  component: GeneratedComponent;
}

// Self-closing HTML elements that don't accept children
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

export function DynamicComponent({ component }: DynamicComponentProps) {
  return renderElement(component, undefined, true);
}

function renderElement(node: GeneratedComponent, key?: number, isRoot = false): React.ReactNode {
  const { element, className, props = {}, content, children } = node;

  // Sanitize element name - only allow valid HTML elements
  const sanitizedElement = sanitizeElement(element);
  
  // For root element, ensure it fills the container
  const rootClasses = isRoot ? 'w-full h-full' : '';
  const combinedClassName = [rootClasses, className].filter(Boolean).join(' ') || undefined;
  
  // Build props object
  const elementProps: Record<string, unknown> = {
    ...props,
    className: combinedClassName,
    key,
  };

  // Remove undefined values
  Object.keys(elementProps).forEach((k) => {
    if (elementProps[k] === undefined) {
      delete elementProps[k];
    }
  });

  // Handle void elements (self-closing)
  if (VOID_ELEMENTS.has(sanitizedElement)) {
    return createElement(sanitizedElement, elementProps);
  }

  // Build children array
  const childNodes: React.ReactNode[] = [];

  // Add text content if present
  if (content) {
    childNodes.push(content);
  }

  // Add nested children
  if (children && children.length > 0) {
    children.forEach((child, index) => {
      childNodes.push(renderElement(child, index));
    });
  }

  // If no children, pass null to avoid empty children warning
  if (childNodes.length === 0) {
    return createElement(sanitizedElement, elementProps);
  }

  return createElement(sanitizedElement, elementProps, ...childNodes);
}

// Allowlist of safe HTML elements
const ALLOWED_ELEMENTS = new Set([
  // Structural
  'div', 'span', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Text
  'p', 'a', 'strong', 'em', 'small', 'mark', 'del', 'ins', 'sub', 'sup', 'br', 'hr',
  // Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Forms
  'form', 'input', 'textarea', 'select', 'option', 'optgroup', 'button', 'label', 'fieldset', 'legend',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Media
  'img', 'figure', 'figcaption', 'picture', 'video', 'audio', 'source', 'track',
  // Other
  'blockquote', 'pre', 'code', 'address', 'time', 'progress', 'meter', 'details', 'summary',
]);

function sanitizeElement(element: string): string {
  const normalized = element.toLowerCase().trim();
  
  if (ALLOWED_ELEMENTS.has(normalized)) {
    return normalized;
  }
  
  // Default to div for unknown elements
  console.warn(`Unknown element "${element}", falling back to div`);
  return 'div';
}
