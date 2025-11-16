/**
 * API module for chat functionality
 * Makes requests to the Cloudflare Worker endpoint
 */

// Load configuration dynamically
let config = null;

async function loadConfig() {
  if (config) return config;
  
  try {
    // Try loading from assets/chat/config.json first (correct location)
    const response = await fetch('./assets/chat/config.json');
    if (!response.ok) {
      throw new Error(`Config load failed: ${response.status}`);
    }
    config = await response.json();
  } catch (e) {
    console.error('Failed to load config:', e);
    // Fallback to window.WORKER_URL if config fails to load
    config = {
      apiBase: window.WORKER_URL || 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev',
      workerUrl: window.WORKER_URL || 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev'
    };
  }
  
  return config;
}

/**
 * Get the worker base URL from config
 */
async function getWorkerBase() {
  const cfg = await loadConfig();
  
  // Prefer apiBase, fall back to workerUrl, then window.WORKER_URL
  let base = cfg.apiBase || cfg.workerUrl || window.WORKER_URL || '';
  
  // Remove trailing slashes
  return base.replace(/\/+$/, '');
}

/**
 * Make a fetch request to the worker with retry logic
 */
async function workerFetch(path, payload, signal) {
  const base = await getWorkerBase();
  if (!base) {
    throw new Error('Worker base URL not configured');
  }
  
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  
  // Retry logic with exponential backoff for 429/5xx errors
  const delays = [300, 800, 1500];
  let lastError = null;
  
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 10000); // 10s timeout
    
    // Combine timeout signal with user-provided signal
    const combinedSignal = signal || controller.signal;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload || {}),
        signal: combinedSignal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        return await response.json();
      }
      
      // Check if we should retry (429 or 5xx errors)
      if (attempt < delays.length && (response.status === 429 || response.status >= 500)) {
        lastError = new Error(`HTTP ${response.status} from ${path}`);
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        continue;
      }
      
      // Non-retryable error
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
      
    } catch (error) {
      clearTimeout(timeout);
      
      // If aborted by user signal, don't retry
      if (error.name === 'AbortError' && signal?.aborted) {
        throw error;
      }
      
      // On last attempt, throw the error
      if (attempt >= delays.length) {
        throw lastError || error;
      }
      
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

/**
 * Send a chat request to the worker
 * @param {Object} params - Request parameters
 * @param {string} params.mode - Chat mode (sales-coach, role-play, etc.)
 * @param {Array} params.messages - Array of message objects with role and content
 * @param {AbortSignal} params.signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} Response with reply, coach data, and plan
 */
export async function chat({ mode, messages, signal }) {
  if (!mode) {
    throw new Error('Mode is required');
  }
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required and must not be empty');
  }
  
  const payload = {
    mode,
    messages,
    threadId: crypto.randomUUID() // Generate a unique thread ID for this request
  };
  
  return await workerFetch('/chat', payload, signal);
}
