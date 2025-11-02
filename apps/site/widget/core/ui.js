/**
 * UI Module - Pure DOM and render helpers
 * All DOM manipulation functions extracted from widget.js
 */

import { bus } from './bus.js';

/**
 * Escape HTML to prevent XSS
 */
export function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize LLM output (remove code blocks, headers)
 */
export function sanitizeLLM(raw) {
  let s = String(raw || '');
  s = s.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/<pre[\s\S]*?<\/pre>/gi, '');
  s = s.replace(/^\s*#{1,6}\s+/gm, '');
  s = s.replace(/^\s*(hi|hello|hey)[^\n]*\n+/i, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

/**
 * Clamp text length
 */
export function clampLength(str, maxLen) {
  const s = String(str || '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen).replace(/\s+\S*$/, '').trim() + '…';
}

/**
 * Create element with attributes and children
 */
export function createElement(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      elem.className = value;
    } else if (key === 'innerHTML') {
      elem.innerHTML = value;
    } else if (key === 'textContent') {
      elem.textContent = value;
    } else if (key.startsWith('data-')) {
      elem.setAttribute(key, value);
    } else if (key.startsWith('aria-')) {
      elem.setAttribute(key, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(elem.style, value);
    } else {
      elem[key] = value;
    }
  });

  children.forEach(child => {
    if (typeof child === 'string') {
      elem.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      elem.appendChild(child);
    }
  });

  return elem;
}

/**
 * Show/hide element
 */
export function setVisible(elem, visible) {
  if (!elem) return;
  elem.style.display = visible ? '' : 'none';
}

/**
 * Add CSS class
 */
export function addClass(elem, className) {
  if (!elem) return;
  elem.classList.add(className);
}

/**
 * Remove CSS class
 */
export function removeClass(elem, className) {
  if (!elem) return;
  elem.classList.remove(className);
}

/**
 * Toggle CSS class
 */
export function toggleClass(elem, className, force) {
  if (!elem) return;
  if (force !== undefined) {
    elem.classList.toggle(className, force);
  } else {
    elem.classList.toggle(className);
  }
}

/**
 * Typing indicator component
 */
export function createTypingIndicator() {
  const indicator = createElement('div', {
    className: 'typing-indicator',
    'aria-live': 'polite',
    'aria-label': 'Assistant is typing'
  }, [
    createElement('span', { className: 'typing-dot' }),
    createElement('span', { className: 'typing-dot' }),
    createElement('span', { className: 'typing-dot' })
  ]);
  
  return indicator;
}

/**
 * Show typing indicator
 */
export function showTypingIndicator(container) {
  if (!container) return null;
  
  const existing = container.querySelector('.typing-indicator');
  if (existing) return existing;
  
  const indicator = createTypingIndicator();
  
  // Use RAF to batch DOM update
  requestAnimationFrame(() => {
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  });
  
  return indicator;
}

/**
 * Hide typing indicator
 */
export function hideTypingIndicator(container) {
  if (!container) return;
  
  const indicator = container.querySelector('.typing-indicator');
  if (indicator) {
    requestAnimationFrame(() => {
      indicator.remove();
    });
  }
}

/**
 * Create message bubble
 */
export function createMessageBubble(content, role = 'assistant', opts = {}) {
  const bubble = createElement('div', {
    className: `message-bubble message-${role}`,
    'data-role': role
  });

  if (opts.timestamp) {
    const time = createElement('div', {
      className: 'message-time',
      textContent: new Date(opts.timestamp).toLocaleTimeString()
    });
    bubble.appendChild(time);
  }

  const body = createElement('div', {
    className: 'message-body'
  });

  // Security: Only set innerHTML for pre-sanitized content
  // For user content, use textContent to prevent XSS
  if (typeof content === 'string') {
    if (opts.allowHTML && opts.sanitized) {
      // SECURITY NOTE: innerHTML only used when content is explicitly marked as sanitized
      // This is needed for rendering formatted responses from mode renderers
      // Mode renderers MUST escape user input before passing content here
      body.innerHTML = content; // nosemgrep: javascript.lang.security.audit.xss.innerHTML-modified.innerHTML-modified
    } else {
      // Safe default: use textContent to prevent XSS
      body.textContent = content;
    }
  } else if (content instanceof Node) {
    body.appendChild(content);
  }

  bubble.appendChild(body);

  if (opts.metadata) {
    const meta = createElement('div', {
      className: 'message-metadata',
      textContent: opts.metadata
    });
    bubble.appendChild(meta);
  }

  return bubble;
}

/**
 * Append message to chat container (batched via RAF)
 */
export function appendMessage(container, bubble) {
  if (!container || !bubble) return;

  requestAnimationFrame(() => {
    container.appendChild(bubble);
    // Smooth scroll to bottom
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  });
}

/**
 * Create retry button for failed requests
 */
export function createRetryButton(onRetry) {
  return createElement('button', {
    className: 'retry-button',
    textContent: 'Retry',
    onclick: onRetry
  });
}

/**
 * Create error message
 */
export function createErrorMessage(message, requestId = null) {
  const container = createElement('div', {
    className: 'error-message'
  });

  const text = createElement('div', {
    className: 'error-text',
    textContent: message
  });

  container.appendChild(text);

  if (requestId) {
    const id = createElement('div', {
      className: 'error-request-id',
      textContent: `Request ID: ${requestId}`
    });
    container.appendChild(id);
  }

  return container;
}

/**
 * Create fast-fail timeout UI (8s timeout)
 */
let fastFailTimeout = null;

export function startFastFailTimer(container, onRetry, timeoutMs = 8000) {
  clearFastFailTimer();

  fastFailTimeout = setTimeout(() => {
    const errorMsg = createErrorMessage(
      'No response received within 8 seconds.',
      `req_${Date.now()}`
    );

    const retryBtn = createRetryButton(() => {
      errorMsg.remove();
      if (onRetry) onRetry();
    });

    errorMsg.appendChild(retryBtn);

    requestAnimationFrame(() => {
      hideTypingIndicator(container);
      container.appendChild(errorMsg);
      container.scrollTop = container.scrollHeight;
    });

    bus.emit('ui:fast-fail', { timeoutMs });
  }, timeoutMs);

  return fastFailTimeout;
}

export function clearFastFailTimer() {
  if (fastFailTimeout) {
    clearTimeout(fastFailTimeout);
    fastFailTimeout = null;
  }
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Request animation frame batch processor with automatic cleanup
 */
const rafBatches = new Map();
const RAF_BATCH_TTL = 5000; // 5 seconds

export function batchInRAF(key, fn) {
  if (rafBatches.has(key)) {
    const existing = rafBatches.get(key);
    cancelAnimationFrame(existing.rafId);
    clearTimeout(existing.ttl);
  }

  const rafId = requestAnimationFrame(() => {
    fn();
    rafBatches.delete(key);
  });

  // Set TTL to auto-cleanup if RAF never fires (edge case)
  const ttl = setTimeout(() => {
    if (rafBatches.has(key)) {
      cancelAnimationFrame(rafBatches.get(key).rafId);
      rafBatches.delete(key);
    }
  }, RAF_BATCH_TTL);

  rafBatches.set(key, { rafId, ttl });
}

/**
 * Create section header
 */
export function createSectionHeader(title, level = 3) {
  return createElement(`h${level}`, {
    className: 'section-header',
    textContent: title
  });
}

/**
 * Create section container
 */
export function createSection(title, content, className = '') {
  const section = createElement('div', {
    className: `section ${className}`.trim()
  });

  if (title) {
    section.appendChild(createSectionHeader(title));
  }

  if (typeof content === 'string') {
    const body = createElement('div', {
      className: 'section-body',
      innerHTML: content
    });
    section.appendChild(body);
  } else if (content instanceof Node) {
    section.appendChild(content);
  }

  return section;
}

/**
 * Parse markdown-style bold text
 */
export function parseSimpleMarkdown(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}
