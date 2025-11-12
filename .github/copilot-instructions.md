# Copilot Instructions for ReflectivAI


## Project Architecture

- **Modular design:** Major logic is split into core modules (`assets/chat/core/`) and mode modules (`assets/chat/modes/`).
- **Core modules** provide event bus, disposables (resource cleanup), centralized mode state, API calls, and mode switching.
- **Modes** (role-play, sales-coach, emotional-intelligence, product-knowledge) are isolated, loaded dynamically, and fully torn down before switching. Teardown flushes all listeners, timers, abort controllers, and observers to prevent cross-mode state bleed.

## Key Patterns & Conventions

- **Event Bus:** Use `createBus()` from `core/eventBus.js` for inter-module communication.
  - Example:
    ```js
    import { createBus } from './core/eventBus.js';
    const bus = createBus();
    const unsub = bus.on('event', fn);
    bus.emit('event', { data: 'value' });
    unsub();
    ```
- **Disposables:** Use `createDisposer()` from `core/disposables.js` to manage cleanup of listeners, timers, observers, and abortable operations.
  - Example:
    ```js
    const disposer = createDisposer();
    disposer.wrap(element, 'click', handler);
    disposer.interval(1000, fn);
    disposer.flush();
    ```
- **Mode Store:** Use `createModeStore()` for centralized state; listen for `mode:willChange` and `mode:didChange` events.
- **API Calls:** Use `chat({ mode, messages, signal })` from `core/api.js`. Supports abort via `AbortController`.
- **Mode Modules:** Each exports `createModule({ bus, store, register })` returning `{ init, teardown }`. All DOM selectors are reused safely due to teardown.
- **Dynamic Imports:** Modes are loaded on demand; always call `teardown()` and flush disposables before switching.
- **Global Config:** Set API endpoints via `globalThis.COACH_ENDPOINT` or `globalThis.WORKER_URL`.

## Developer Workflows

- **Testing:**
  - Isolation: `node test_isolation.js`
  - Disposables: `node test_disposables.js`
  - API: `node test_api.js`
- **Build/Deploy:** Use shell scripts in project root (e.g., `deploy-worker-r9.sh`, `comprehensive-test.sh`).
- **Debugging:** Use teardown and disposables to ensure no lingering state. Check mode switching logic for leaks.

## Integration Points

- Worker API endpoint is configurable via global variable.
- All network requests routed through `core/api.js`.
- No direct cross-module DOM manipulation; all handled via event bus and mode modules.

## Examples

- **Switching modes:**
  ```js
  await switcher.switchMode('role-play');
  await switcher.switchMode('sales-coach');
  ```
- **Registering cleanup:**
  ```js
  disposer.wrap(element, 'click', handler);
  disposer.interval(1000, fn);
  disposer.flush();
  ```

## References

- See `assets/chat/README.md` for detailed architecture and API documentation.
- Key files: `core/eventBus.js`, `core/disposables.js`, `core/modeStore.js`, `core/api.js`, `core/switcher.js`, `modes/*.js`

---
**Feedback requested:** If any section is unclear, incomplete, or missing, please specify so it can be improved for future AI agents.
