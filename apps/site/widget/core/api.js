/**
 * API Module - Network layer with timeouts, retries, and abort signals
 * Supports both regular fetch and EventSource streaming
 */

import { bus } from './bus.js';

// Configuration constants
const DEFAULT_TIMEOUT = 10000; // 10s
const MAX_RETRIES = 3;
const RETRY_DELAYS = [600, 1200, 2400]; // exponential backoff in ms
const AUTO_RETRY_DELAY = 500; // ms delay before auto-retry

// Export for configurability
export const API_CONFIG = {
  timeout: DEFAULT_TIMEOUT,
  maxRetries: MAX_RETRIES,
  retryDelays: RETRY_DELAYS,
  autoRetryDelay: AUTO_RETRY_DELAY
};

/**
 * Get worker endpoint base URL from config or global
 */
function getWorkerBase() {
  const raw = (
    window.COACH_ENDPOINT || 
    window.WORKER_URL || 
    window.REFLECTIV_CONFIG?.workerUrl || 
    ''
  ).trim();
  
  if (!raw) return '';
  // Strip trailing /chat, then trailing slashes
  return raw.replace(/\/chat\/?$/i, '').replace(/\/+$/g, '');
}

/**
 * Fetch with timeout and abort signal
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error === 'timeout') {
      throw new Error('REQUEST_TIMEOUT');
    }
    throw error;
  }
}

/**
 * Fetch with exponential backoff retries
 */
async function fetchWithRetry(url, options = {}, timeoutMs = DEFAULT_TIMEOUT) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      
      // Don't retry on 4xx errors (client errors)
      if (!response.ok && response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Success or non-retryable error
      if (response.ok) {
        return response;
      }
      
      // Server error - retry
      lastError = new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on timeout if we've already tried
      if (error.message === 'REQUEST_TIMEOUT' && attempt >= 1) {
        throw error;
      }
    }

    // Wait before retry (except on last attempt)
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      bus.emit('api:retry', { attempt: attempt + 1, url });
    }
  }

  throw lastError || new Error('MAX_RETRIES_EXCEEDED');
}

/**
 * POST JSON to worker endpoint
 */
export async function postJSON(path, payload, timeoutMs = DEFAULT_TIMEOUT) {
  const base = getWorkerBase();
  if (!base) {
    throw new Error('WORKER_BASE_MISSING');
  }

  const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
  
  bus.emit('api:request', { url, payload });

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const data = await response.json();
  bus.emit('api:response', { url, data });
  
  return data;
}

/**
 * GET JSON from worker endpoint
 */
export async function getJSON(path, timeoutMs = DEFAULT_TIMEOUT) {
  const base = getWorkerBase();
  if (!base) {
    throw new Error('WORKER_BASE_MISSING');
  }

  const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  return response.json();
}

/**
 * Stream chat via EventSource (SSE)
 * Returns an EventSource object that emits chunks
 */
export function streamChat(payload, callbacks = {}) {
  const base = getWorkerBase();
  if (!base) {
    throw new Error('WORKER_BASE_MISSING');
  }

  // Build URL with query params for GET-style SSE
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (typeof value === 'object') {
      params.append(key, JSON.stringify(value));
    } else {
      params.append(key, String(value));
    }
  });

  const url = `${base}/chat?${params.toString()}`;
  const eventSource = new EventSource(url);

  // Show typing indicator immediately
  if (callbacks.onStart) {
    setTimeout(() => callbacks.onStart(), 100);
  }

  let buffer = '';
  
  eventSource.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.chunk) {
        buffer += data.chunk;
        if (callbacks.onChunk) {
          callbacks.onChunk(data.chunk, buffer);
        }
      }
      
      if (data.done) {
        eventSource.close();
        if (callbacks.onComplete) {
          callbacks.onComplete(buffer, data);
        }
      }
    } catch (error) {
      console.error('SSE parse error:', error);
    }
  });

  eventSource.addEventListener('error', (error) => {
    eventSource.close();
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  });

  bus.emit('api:stream:start', { url });

  return {
    source: eventSource,
    buffer,
    close: () => eventSource.close()
  };
}

/**
 * Load local resource with caching
 */
const resourceCache = new Map();

export async function loadResource(path, useCache = true) {
  if (useCache && resourceCache.has(path)) {
    return resourceCache.get(path);
  }

  const response = await fetch(path, { cache: useCache ? 'default' : 'no-store' });
  
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') 
    ? await response.json() 
    : await response.text();

  if (useCache) {
    resourceCache.set(path, data);
  }

  return data;
}

/**
 * Preload resources on page load
 */
export async function preloadResources(resources = []) {
  const defaults = [
    'assets/chat/config.json',
    'assets/chat/data/scenarios.merged.json'
  ];
  
  const toLoad = [...defaults, ...resources];
  
  bus.emit('api:preload:start', { resources: toLoad });

  const results = await Promise.allSettled(
    toLoad.map(path => loadResource(path, true))
  );

  const loaded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  bus.emit('api:preload:complete', { loaded, failed, total: toLoad.length });

  return { loaded, failed };
}
