/**
 * Product Knowledge Renderer
 */

import { createElement, parseSimpleMarkdown } from '../../core/ui.js';

export function renderProductKnowledge(response, container) {
  if (!container) return;
  
  container.innerHTML = '';
  
  const content = typeof response === 'string' ? response : JSON.stringify(response);
  
  const section = createElement('div', {
    className: 'product-knowledge-content',
    innerHTML: parseSimpleMarkdown(content)
  });
  
  container.appendChild(section);
}
