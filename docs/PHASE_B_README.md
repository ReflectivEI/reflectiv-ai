# Phase B: EI Emission Feature Implementation

## Overview
This implementation adds Emotional Intelligence (EI) scoring and emission capabilities to the chat worker for `sales-simulation` mode, with support for both JSON and Server-Sent Events (SSE) responses.

## Features Implemented

### 1. Feature Flag Configuration (`src/config.ts`)
- **`emitEi` flag** (default: `false`)
- Reads from:
  - Query parameter: `?emitEi=true` or `?emitEi=1`
  - Header: `x-ei-emit: 1`
- Returns `{ emitEi: boolean }` configuration object

### 2. EI Schema (`src/schema/coach.json`)
- JSON schema for EI payload validation
- Scores: `empathy`, `discovery`, `compliance`, `clarity`, `accuracy` (integers 1-5)
- Optional: `rationales` (object), `tips` (array, max 5 items)
- Required: `scores`, `rubric_version`

### 3. Deterministic EI Scoring (`src/ei/eiRules.ts`)
- **`scoreEi({ text, mode })`** function
- Heuristics-based scoring:
  - **Empathy**: Keyword detection (understand, feel, care, patient, etc.)
  - **Discovery**: Question density, discovery keywords (would, could, how, etc.)
  - **Compliance**: Label anchors (per label, FDA, CDC, guidelines)
  - **Clarity**: Average sentence length analysis
  - **Accuracy**: Word count and detail level
- Prohibited claims detection (cure, guarantee, no side effects, etc.)
- Returns `EiPayload` with scores, rationales, tips, and rubric version v1.2
- All scores clamped to 1-5 range

### 4. Type Definitions (`src/types.ts`)
- `EiScores`: Score object interface
- `EiPayload`: Complete EI response interface
- `ChatResponse`: Extended with `_coach: { ei?: EiPayload }`
- `Config`, `Env`, `Fact`, `Plan` interfaces

### 5. Chat Route with EI Support (`src/routes/chat.ts`)
- Parses `emitEi` config via `fromRequest(req)`
- **Sales-simulation mode only**: Runs `scoreEi()` on assistant reply
- **SSE Support**:
  - Detects `Accept: text/event-stream` header
  - Emits `event: coach.partial` with partial scores
  - Emits `event: coach.final` with complete EI payload
- **JSON Support**: Includes `_coach.ei` in response body
- Validates EI payload before emission
- Logs validation failures with PII redaction

### 6. Metrics (`src/metrics.ts`)
- **Counters**:
  - `ei_emitted_total`: Successfully emitted EI payloads
  - `ei_validation_failed_total`: Failed validations
- **Histogram**: `ei_latency_histogram` for EI scoring latency
- `withTiming()` wrapper for latency tracking
- `getMetrics()` endpoint at `GET /metrics`

### 7. PII/PHI Redaction (`src/utils/redact.ts`)
- Redacts emails, phone numbers, MRNs, HCP names
- Pattern-based regex filtering
- Used in all logging operations
- `redactPII(text)` and `redactObject(obj)` functions

### 8. CORS Configuration
- ✅ `https://reflectivei.github.io` added to allowlist (wrangler.toml)
- Header includes `x-ei-emit` in allowed headers

## Project Structure
```
reflectiv-ai/
├── src/
│   ├── config.ts              # emitEi flag parser
│   ├── data.ts                # Facts DB, FSM, schemas
│   ├── index.ts               # Main worker entry point
│   ├── metrics.ts             # EI metrics tracking
│   ├── types.ts               # TypeScript interfaces
│   ├── validator.ts           # EI payload validation
│   ├── ei/
│   │   └── eiRules.ts         # Deterministic EI scoring
│   ├── routes/
│   │   ├── chat.ts            # Chat endpoint with EI
│   │   └── facts-plan.ts      # Facts and plan endpoints
│   ├── schema/
│   │   └── coach.json         # EI JSON schema
│   └── utils/
│       ├── helpers.ts         # CORS, JSON, text utilities
│       └── redact.ts          # PII/PHI redaction
├── docs/
│   ├── EI_TRANSCRIPTS.md      # Sample JSON/SSE responses
│   └── METRICS_OUTPUT.txt     # Metrics test output
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config
├── wrangler.toml              # Cloudflare Worker config
└── worker.js                  # Built output
```

## Tests
Lightweight unit tests included:

### EI Rules Tests (`src/ei/eiRules.test.ts`)
- ✅ Scores clamped to 1-5
- ✅ Tips array max 5 items
- ✅ Rubric version v1.2
- ✅ Question detection for discovery
- ✅ Compliance anchor detection

### Config Tests (`src/config.test.ts`)
- ✅ Query param `emitEi=true` parsing
- ✅ Query param `emitEi=1` parsing
- ✅ Header `x-ei-emit: 1` parsing
- ✅ Default to false

### Validator Tests (`src/validator.test.ts`)
- ✅ Valid payload acceptance
- ✅ Missing required fields rejection
- ✅ Score range validation (1-5)
- ✅ Integer-only scores
- ✅ Tips array size limit (max 5)

### Redaction Tests (`src/utils/redact.test.ts`)
- ✅ Email redaction
- ✅ Phone number redaction
- ✅ HCP name redaction
- ✅ Non-PII preservation

## Building and Testing
```bash
# Install dependencies
npm install

# Build TypeScript to worker.js
npm run build

# Run tests
npx tsx --test src/**/*.test.ts

# Test metrics
npx tsx test-metrics.js

# Deploy (requires Cloudflare credentials)
npm run deploy
```

## API Examples

### Enable EI via Query Parameter
```bash
curl -X POST "https://worker.dev/chat?emitEi=1" \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"How to discuss PrEP?"}'
```

### Enable EI via Header
```bash
curl -X POST "https://worker.dev/chat" \
  -H "Content-Type: application/json" \
  -H "x-ei-emit: 1" \
  -d '{"mode":"sales-simulation","user":"How to discuss PrEP?"}'
```

### SSE Stream
```bash
curl -X POST "https://worker.dev/chat?emitEi=1" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"Safety discussion tips?"}'
```

### Check Metrics
```bash
curl "https://worker.dev/metrics"
```

## Security & Privacy
- ✅ No PHI/PII in logs (redaction applied)
- ✅ EI scoring is deterministic (no data sent to external services)
- ✅ Validation failures logged with redaction
- ✅ Metrics exclude sensitive data

## Deliverables Checklist
- [x] Feature flag `emitEi` via query/header
- [x] EI schema with required fields
- [x] Deterministic scoring with heuristics
- [x] Type definitions for EI payload
- [x] Chat route with EI emission
- [x] SSE support (coach.partial → coach.final)
- [x] JSON response support (_coach.ei)
- [x] Schema validation
- [x] Metrics (counters + histogram)
- [x] PII/PHI redaction
- [x] CORS allowlist includes reflectivei.github.io
- [x] Unit tests (EI, config, validator, redaction)
- [x] Sample transcripts (JSON/SSE)
- [x] Metrics demonstration
- [x] Documentation

## Notes
- EI emission **only** for `mode=sales-simulation`
- `role-play` mode does NOT include EI
- Default behavior unchanged when `emitEi` is not enabled
- Backward compatible with existing API
