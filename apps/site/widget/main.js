/**
 * Main Widget Entry Point
 * Loads mode modules dynamically and mounts the modal once
 * Feature flag controls whether to use new modular code or fallback to widget.js
 */

import { bus } from './core/bus.js';
import { preloadResources, postJSON, loadResource, API_CONFIG } from './core/api.js';
import * as ui from './core/ui.js';
import { guardedValidate, resetGuards } from './core/guards.js';

// Feature flag - set to true to use new modular widget
const USE_NEW_WIDGET = window.REFLECTIV_USE_NEW_WIDGET !== false;

// Mode renderers cache
const modeRenderers = new Map();

/**
 * Load mode renderer dynamically
 */
async function loadModeRenderer(mode) {
  if (modeRenderers.has(mode)) {
    return modeRenderers.get(mode);
  }

  try {
    const modulePath = `/apps/site/widget/modes/${mode}/renderer.js`;
    const module = await import(modulePath);
    
    // Get the render function based on mode
    const renderFunctionName = `render${mode.split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join('')}`;
    
    const renderer = module[renderFunctionName] || module.default;
    
    if (!renderer) {
      console.warn(`No renderer found for mode: ${mode}`);
      return null;
    }

    modeRenderers.set(mode, renderer);
    return renderer;
  } catch (error) {
    console.error(`Failed to load renderer for mode: ${mode}`, error);
    return null;
  }
}

/**
 * Widget state
 */
const state = {
  mounted: false,
  container: null,
  currentMode: 'sales-simulation',
  conversation: [],
  config: null,
  scenarios: null
};

/**
 * Initialize widget
 */
async function init() {
  if (!USE_NEW_WIDGET) {
    console.log('ReflectivWidget: Using fallback widget.js');
    return;
  }

  console.log('ReflectivWidget: Initializing new modular widget');

  // Preload resources
  try {
    await preloadResources();
    bus.emit('widget:resources-loaded');
  } catch (error) {
    console.warn('Failed to preload some resources:', error);
  }

  // Load config
  try {
    state.config = await loadResource('assets/chat/config.json');
    state.scenarios = await loadResource('assets/chat/data/scenarios.merged.json');
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  bus.emit('widget:initialized');
}

/**
 * Mount widget into container
 */
export async function mount(container) {
  if (!USE_NEW_WIDGET) {
    // Fallback to old widget
    if (window.ReflectivCoach && window.ReflectivCoach.mount) {
      return window.ReflectivCoach.mount(container);
    }
    console.error('Fallback widget not available');
    return;
  }

  if (state.mounted) {
    console.warn('Widget already mounted');
    return;
  }

  if (!container) {
    console.error('No container provided for widget mount');
    return;
  }

  state.container = container;
  state.mounted = true;

  // Build UI
  buildUI(container);

  bus.emit('widget:mounted', { container });
}

/**
 * Build widget UI
 */
function buildUI(container) {
  container.innerHTML = '';

  // Create main structure
  const wrapper = ui.createElement('div', {
    className: 'reflectiv-widget-wrapper'
  });

  // Mode selector
  const modeSelector = createModeSelector();
  wrapper.appendChild(modeSelector);

  // Chat container
  const chatContainer = ui.createElement('div', {
    className: 'reflectiv-chat-container',
    id: 'reflectiv-chat-messages'
  });
  wrapper.appendChild(chatContainer);

  // Input area
  const inputArea = createInputArea();
  wrapper.appendChild(inputArea);

  container.appendChild(wrapper);
}

/**
 * Create mode selector
 */
function createModeSelector() {
  const modes = [
    { id: 'sales-simulation', label: 'Sales Simulation' },
    { id: 'product-knowledge', label: 'Product Knowledge' },
    { id: 'role-play', label: 'Role Play' },
    { id: 'emotional-assessment', label: 'Emotional Assessment' }
  ];

  const selector = ui.createElement('div', {
    className: 'mode-selector'
  });

  const label = ui.createElement('label', {
    textContent: 'Mode: ',
    className: 'mode-label'
  });
  selector.appendChild(label);

  const select = ui.createElement('select', {
    className: 'mode-select',
    id: 'mode-select'
  });

  modes.forEach(mode => {
    const option = ui.createElement('option', {
      value: mode.id,
      textContent: mode.label,
      selected: mode.id === state.currentMode
    });
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    state.currentMode = e.target.value;
    resetGuards();
    bus.emit('widget:mode-changed', { mode: state.currentMode });
  });

  selector.appendChild(select);

  return selector;
}

/**
 * Create input area with debounced input
 */
function createInputArea() {
  const inputArea = ui.createElement('div', {
    className: 'reflectiv-input-area'
  });

  const textarea = ui.createElement('textarea', {
    className: 'reflectiv-input',
    placeholder: 'Type your message...',
    rows: 3,
    id: 'reflectiv-input'
  });

  // Debounce input events to avoid layout thrash
  const debouncedInput = ui.debounce((e) => {
    bus.emit('widget:input-changed', { value: e.target.value });
  }, 300);

  textarea.addEventListener('input', debouncedInput);

  inputArea.appendChild(textarea);

  const sendButton = ui.createElement('button', {
    className: 'reflectiv-send-button',
    textContent: 'Send',
    onclick: () => handleSend()
  });

  inputArea.appendChild(sendButton);

  return inputArea;
}

/**
 * Handle send message
 */
async function handleSend() {
  const input = document.getElementById('reflectiv-input');
  const chatContainer = document.getElementById('reflectiv-chat-messages');
  
  if (!input || !chatContainer) return;

  const message = input.value.trim();
  if (!message) return;

  // Clear input
  input.value = '';

  // Add user message
  const userBubble = ui.createMessageBubble(message, 'user');
  ui.appendMessage(chatContainer, userBubble);

  // Add conversation to state
  state.conversation.push({ role: 'user', content: message });

  // Show typing indicator
  ui.showTypingIndicator(chatContainer);

  // Start fast-fail timer (8s timeout)
  const retryFn = () => handleSend();
  ui.startFastFailTimer(chatContainer, retryFn, 8000);

  try {
    // Send to API
    const response = await postJSON('/chat', {
      mode: state.currentMode,
      user: message,
      history: state.conversation.slice(-10) // Last 10 messages
    }, 10000);

    // Clear fast-fail timer
    ui.clearFastFailTimer();

    // Hide typing indicator
    ui.hideTypingIndicator(chatContainer);

    // Validate response
    const validation = guardedValidate(response.reply, state.currentMode);

    if (!validation.valid && validation.shouldRetry) {
      // Re-send with corrective hint
      console.log('Invalid response, retrying with hint:', validation.hint);
      state.conversation.push({
        role: 'system',
        content: validation.hint
      });
      
      // Auto-retry with configurable delay
      setTimeout(() => handleSend(), API_CONFIG.autoRetryDelay);
      return;
    }

    // Add assistant message
    state.conversation.push({ role: 'assistant', content: response.reply });

    // Render response using mode renderer
    await renderResponse(response.reply, chatContainer);

  } catch (error) {
    console.error('Send error:', error);
    
    ui.clearFastFailTimer();
    ui.hideTypingIndicator(chatContainer);

    const errorMsg = ui.createErrorMessage(
      `Error: ${error.message}`,
      `req_${Date.now()}`
    );
    const retryBtn = ui.createRetryButton(retryFn);
    errorMsg.appendChild(retryBtn);
    
    ui.appendMessage(chatContainer, errorMsg);

    bus.emit('widget:error', { error: error.message });
  }
}

/**
 * Render response using mode-specific renderer
 */
async function renderResponse(response, container) {
  const renderer = await loadModeRenderer(state.currentMode);

  if (!renderer) {
    // Fallback to simple text rendering - use textContent for safety
    const textContent = typeof response === 'string' ? response : JSON.stringify(response);
    const bubble = ui.createMessageBubble(textContent, 'assistant');
    ui.appendMessage(container, bubble);
    return;
  }

  // Create container for mode-specific rendering
  const responseContainer = ui.createElement('div', {
    className: `message-bubble message-assistant message-${state.currentMode}`
  });

  // Use RAF to batch render
  ui.batchInRAF('render-response', () => {
    try {
      renderer(response, responseContainer);
      ui.appendMessage(container, responseContainer);
    } catch (error) {
      console.error('Render error:', error);
      // Fallback - use textContent for safety
      const textContent = typeof response === 'string' ? response : JSON.stringify(response);
      responseContainer.textContent = textContent;
      ui.appendMessage(container, responseContainer);
    }
  });
}

/**
 * Global mount function
 */
window.ReflectivWidget = {
  mount,
  init,
  USE_NEW_WIDGET
};

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

// Expose for debugging
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.ReflectivWidget.debug = {
    state,
    bus,
    ui,
    loadModeRenderer
  };
}
