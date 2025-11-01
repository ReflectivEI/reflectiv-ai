# ReflectivAI Chat Module Architecture

## Overview

This modular architecture splits the monolithic widget.js into isolated, maintainable modules with full teardown to prevent cross-mode state pollution.

## Architecture

### Core Modules (`core/`)

#### `eventBus.js`
Event system for inter-module communication.

```javascript
import { createBus } from './core/eventBus.js';

const bus = createBus();
const unsub = bus.on('event', (payload) => console.log(payload));
bus.emit('event', { data: 'value' });
unsub(); // Unsubscribe
```

**API:**
- `on(event, handler)` - Subscribe to events, returns unsubscribe function
- `off(event, handler)` - Unsubscribe from events
- `emit(event, payload)` - Emit events with payload

#### `disposables.js`
Resource cleanup system with support for multiple resource types.

```javascript
import { createDisposer } from './core/disposables.js';

const disposer = createDisposer();

// Register cleanup functions
disposer.add(() => console.log('cleaned'));

// Wrap event listeners for auto-cleanup
disposer.wrap(element, 'click', handler);

// Wrap timers
disposer.interval(1000, () => console.log('tick'));
disposer.timeout(5000, () => console.log('done'));

// Create abortable operations
const { signal, abort } = disposer.abortable();
fetch(url, { signal });

// Cleanup all resources
disposer.flush();
```

**API:**
- `add(fn)` - Register cleanup function
- `wrap(target, type, listener, opts)` - Wrap event listener
- `interval(ms, fn)` - Create interval with auto-cleanup
- `timeout(ms, fn)` - Create timeout with auto-cleanup
- `observe(target, callback, opts)` - Create MutationObserver with auto-cleanup
- `abortable()` - Create AbortController with auto-cleanup
- `flush()` - Execute all cleanup functions

#### `modeStore.js`
Centralized mode state management with change events.

```javascript
import { createModeStore } from './core/modeStore.js';

const store = createModeStore(bus);

// Get current state
const { mode, threadId } = store.get();

// Update state (triggers mode:willChange and mode:didChange events)
store.set({ mode: 'role-play', threadId: crypto.randomUUID() });

// Valid modes
console.log(store.MODES); // ['role-play', 'sales-coach', 'emotional-intelligence', 'product-knowledge']
```

**API:**
- `get()` - Get current state
- `set(partial)` - Update state (validates mode)
- `MODES` - Array of valid mode names

**Events:**
- `mode:willChange` - Fired before mode change
- `mode:didChange` - Fired after mode change

#### `api.js`
Guarded Worker I/O with AbortController support.

```javascript
import { chat } from './core/api.js';

const controller = new AbortController();
const data = await chat({
  mode: 'sales-coach',
  messages: [{ role: 'user', content: 'Hello' }],
  signal: controller.signal
});
console.log(data.reply);
```

**API:**
- `chat({ mode, messages, signal })` - Send chat request to worker

#### `switcher.js`
Mode switching orchestrator with full teardown.

```javascript
import { createModeSwitcher } from './core/switcher.js';

const switcher = createModeSwitcher({ bus, store });

// Switch modes (automatically tears down previous mode)
await switcher.switchMode('role-play');
```

**Features:**
- Calls `teardown()` on active module before switching
- Flushes disposer to clean up resources
- Dynamically imports new mode module
- Initializes new module with fresh state
- Generates new thread ID

### Mode Modules (`modes/`)

Each mode module follows the same pattern:

```javascript
import { chat } from '../core/api.js';

export function createModule({ bus, store, register }) {
  let state = {};

  function init() {
    // Initialize mode
    register.wrap(button, 'click', handleClick);
  }

  function teardown() {
    // Cleanup is automatic via disposer
    // Custom cleanup can be added here
  }

  return { init, teardown };
}
```

#### Available Modes

1. **`rolePlay.js`** - Role-play interaction mode
2. **`salesCoach.js`** - Sales coaching mode
3. **`emotionalIntelligence.js`** - Emotional intelligence assessment mode
4. **`productKnowledge.js`** - Product knowledge query mode

## Usage Example

```javascript
import { createBus } from './core/eventBus.js';
import { createModeStore } from './core/modeStore.js';
import { createModeSwitcher } from './core/switcher.js';

// Initialize core
const bus = createBus();
const store = createModeStore(bus);
const switcher = createModeSwitcher({ bus, store });

// Listen to mode changes
bus.on('mode:didChange', ({ mode }) => {
  console.log('Switched to:', mode);
});

// Switch modes
await switcher.switchMode('role-play');
await switcher.switchMode('sales-coach');
```

## Key Features

### 1. Module Isolation
Each mode module is completely isolated with its own:
- State
- Event handlers
- DOM references
- Network requests

### 2. Full Teardown
When switching modes:
1. Previous module's `teardown()` is called
2. All registered disposables are flushed
3. Event listeners are removed
4. Timers are cancelled
5. AbortControllers are aborted
6. MutationObservers are disconnected

### 3. No Cross-Mode Bleed
The architecture prevents:
- Shared state between modes
- Orphaned event listeners
- Memory leaks
- Stale network requests
- DOM pollution

### 4. Type Safety
All modules use consistent interfaces:
- `createModule({ bus, store, register })` - Factory function
- `{ init, teardown }` - Module interface

## Testing

Run the test suite:

```bash
# Test core modules
node test_isolation.js

# Test disposables
node test_disposables.js

# Test API
node test_api.js
```

All tests validate:
- Module isolation
- Resource cleanup
- Event bus functionality
- State management
- Error handling

## Migration from Monolithic widget.js

The modular architecture provides:
1. **Better maintainability** - Each mode in its own file
2. **Clearer separation of concerns** - Core vs mode-specific logic
3. **Easier testing** - Isolated modules can be tested independently
4. **No side effects** - Full cleanup prevents cross-mode interference
5. **Dynamic loading** - Modes are loaded on-demand via dynamic imports

## Configuration

Set the worker endpoint via global variables:

```javascript
globalThis.COACH_ENDPOINT = 'https://api.example.com';
// or
globalThis.WORKER_URL = 'https://api.example.com';
```

The API module will use these for all requests.
