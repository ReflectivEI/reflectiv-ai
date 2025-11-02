/**
 * Emotional Assessment Renderer
 */

import { createElement, parseSimpleMarkdown } from '../../core/ui.js';

export function renderEmotionalAssessment(response, container) {
  if (!container) return;
  
  container.innerHTML = '';
  
  const content = typeof response === 'string' ? response : JSON.stringify(response);
  
  const section = createElement('div', {
    className: 'emotional-assessment-content',
    innerHTML: parseSimpleMarkdown(content)
  });
  
  container.appendChild(section);
}
