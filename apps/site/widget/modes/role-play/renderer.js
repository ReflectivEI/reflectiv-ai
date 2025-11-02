/**
 * Role Play Renderer
 */

import { createElement, parseSimpleMarkdown } from '../../core/ui.js';

export function renderRolePlay(response, container) {
  if (!container) return;
  
  container.innerHTML = '';
  
  const content = typeof response === 'string' ? response : JSON.stringify(response);
  
  const section = createElement('div', {
    className: 'role-play-content',
    innerHTML: parseSimpleMarkdown(content)
  });
  
  container.appendChild(section);
}
