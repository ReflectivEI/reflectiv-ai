# PATCH RECOMMENDATIONS - LINE-BY-LINE CHANGES

## Overview
This document provides exact line edits for all fixes applied to resolve the AI chat failure issue.

---

## File 1: worker.js

### Patch 1.1: Add Environment Variable Validation
**Location**: Function `providerChat()`, before line 218  
**Reason**: Prevent 502 errors when PROVIDER_KEY is missing  

**BEFORE** (lines 218-227):
```javascript
async function providerChat(env, messages, { maxTokens = 1400, temperature = 0.2 } = {}) {
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;

  const r = await fetch(env.PROVIDER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.PROVIDER_KEY}`
    },
```

**AFTER** (lines 218-241):
```javascript
async function providerChat(env, messages, { maxTokens = 1400, temperature = 0.2 } = {}) {
  // Validate required environment variables
  if (!env.PROVIDER_URL) {
    console.error("PROVIDER_URL not configured");
    throw new Error("provider_url_missing");
  }
  if (!env.PROVIDER_KEY) {
    console.error("PROVIDER_KEY not configured");
    throw new Error("provider_key_missing");
  }
  if (!env.PROVIDER_MODEL) {
    console.error("PROVIDER_MODEL not configured");
    throw new Error("provider_model_missing");
  }

  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;

  const r = await fetch(env.PROVIDER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.PROVIDER_KEY}`
    },
```

**Lines Added**: 13  
**Impact**: Prevents undefined authorization header, provides clear error message

---

### Patch 1.2: Add Facts Array Validation
**Location**: Function `processChatRequest()`, after line 405  
**Reason**: Prevent TypeError when plan has no facts  

**BEFORE** (lines 400-410):
```javascript
  // Load or build a plan
  let activePlan = plan;
  if (!activePlan) {
    const r = await postPlan(new Request("http://x", { method: "POST", body: JSON.stringify({ mode, disease, persona, goal }) }), env);
    activePlan = await r.json();
  }

  // Provider prompts
  const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
  const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join("\n");
```

**AFTER** (lines 400-418):
```javascript
  // Load or build a plan
  let activePlan = plan;
  if (!activePlan) {
    const r = await postPlan(new Request("http://x", { method: "POST", body: JSON.stringify({ mode, disease, persona, goal }) }), env);
    activePlan = await r.json();
  }

  // Validate plan has facts array
  if (!activePlan || !Array.isArray(activePlan.facts)) {
    console.error("Plan missing facts array:", activePlan);
    return json({ 
      error: "invalid_plan", 
      message: "Plan does not contain valid facts array. Please check disease/persona configuration." 
    }, 422, env, req);
  }

  // Provider prompts
  const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
  const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join("\n");
```

**Lines Added**: 8  
**Impact**: Prevents crash, returns actionable error message

---

### Patch 1.3: Extract and Pass System Prompts
**Location**: Function `postChat()`, OpenAI-style conversion, around line 352  
**Reason**: Allow system.md content to influence AI behavior  

**BEFORE** (lines 352-370):
```javascript
    if (isOpenAIStyle) {
      // Extract last user message from messages array
      const messages = body.messages || [];
      const lastUserMsg = messages.filter(m => m.role === "user").pop();
      const userText = lastUserMsg?.content || "";
      
      // Extract mode from messages if system prompt mentions it, otherwise default
      let mode = "sales-simulation";
      const systemMsgs = messages.filter(m => m.role === "system");
      if (systemMsgs.some(m => /role.?play/i.test(m.content || ""))) {
        mode = "role-play";
      } else if (systemMsgs.some(m => /product.?knowledge/i.test(m.content || ""))) {
        mode = "product-knowledge";
      } else if (systemMsgs.some(m => /emotional.?assessment/i.test(m.content || ""))) {
        mode = "emotional-assessment";
      }
      
      // Build history from messages (exclude last user message, already extracted)
      const history = messages
```

**AFTER** (lines 352-373):
```javascript
    if (isOpenAIStyle) {
      // Extract last user message from messages array
      const messages = body.messages || [];
      const lastUserMsg = messages.filter(m => m.role === "user").pop();
      const userText = lastUserMsg?.content || "";
      
      // Extract system prompts (will be used to supplement worker's prompts)
      const systemPrompts = messages.filter(m => m.role === "system").map(m => m.content || "");
      
      // Extract mode from messages if system prompt mentions it, otherwise default
      let mode = "sales-simulation";
      const systemMsgs = messages.filter(m => m.role === "system");
      if (systemMsgs.some(m => /role.?play/i.test(m.content || ""))) {
        mode = "role-play";
      } else if (systemMsgs.some(m => /product.?knowledge/i.test(m.content || ""))) {
        mode = "product-knowledge";
      } else if (systemMsgs.some(m => /emotional.?assessment/i.test(m.content || ""))) {
        mode = "emotional-assessment";
      }
      
      // Build history from messages (exclude last user message, already extracted)
      const history = messages
```

**Lines Added**: 1  
**Lines Modified**: 0  
**Impact**: Extracts system prompts for later use

---

### Patch 1.4: Include System Prompts in Converted Body
**Location**: Function `postChat()`, around line 375  
**Reason**: Pass system prompts to processChatRequest  

**BEFORE** (lines 375-383):
```javascript
      // Convert to ReflectivAI format and continue processing
      const convertedBody = {
        mode,
        user: userText,
        history,
        disease: "",
        persona: "",
        goal: "",
        session: body.session || "anon"
      };
```

**AFTER** (lines 377-386):
```javascript
      // Convert to ReflectivAI format and continue processing
      const convertedBody = {
        mode,
        user: userText,
        history,
        disease: "",
        persona: "",
        goal: "",
        session: body.session || "anon",
        systemPrompts  // Pass along system prompts from client
      };
```

**Lines Added**: 1  
**Impact**: System prompts now passed to processing function

---

### Patch 1.5: Accept System Prompts Parameter
**Location**: Function `processChatRequest()`, around line 386  
**Reason**: Receive system prompts from client  

**BEFORE** (lines 386-396):
```javascript
async function processChatRequest(body, env, req) {
    const {
      mode = "sales-simulation",
      user,
      history = [],
      disease = "",
      persona = "",
      goal = "",
      plan,
      planId
    } = body || {};

    const session = body.session || "anon";
```

**AFTER** (lines 398-409):
```javascript
async function processChatRequest(body, env, req) {
    const {
      mode = "sales-simulation",
      user,
      history = [],
      disease = "",
      persona = "",
      goal = "",
      plan,
      planId,
      systemPrompts = []  // Client-provided system prompts (e.g., from system.md)
    } = body || {};

    const session = body.session || "anon";
```

**Lines Added**: 1  
**Impact**: Function now receives system prompts parameter

---

### Patch 1.6: Prepend System Prompts to Messages
**Location**: Function `processChatRequest()`, building messages array, around line 437  
**Reason**: Use client system prompts before worker's prompts  

**BEFORE** (lines 437-442):
```javascript
  const messages = [
    { role: "system", content: sys },
    ...history.map(m => ({ role: m.role, content: String(m.content || "") })).slice(-18),
    { role: "user", content: String(user || "") }
  ];
```

**AFTER** (lines 449-458):
```javascript
  // Build messages array - prepend client system prompts if provided
  const messages = [
    ...(systemPrompts && systemPrompts.length > 0 
      ? systemPrompts.map(content => ({ role: "system", content }))
      : []
    ),
    { role: "system", content: sys },
    ...history.map(m => ({ role: m.role, content: String(m.content || "") })).slice(-18),
    { role: "user", content: String(user || "") }
  ];
```

**Lines Added**: 6  
**Impact**: Client system prompts now included in context sent to AI

---

### Patch 1.7: Enhanced Error Handling
**Location**: Function `postChat()`, catch block, around line 378  
**Reason**: Provide specific error messages for different failure types  

**BEFORE** (lines 378-382):
```javascript
  } catch (err) {
    // Sanitize error message to avoid leaking sensitive information
    const safeMessage = String(err.message || "invalid").replace(/\s+/g, " ").slice(0, 200);
    return json({ error: "bad_request", message: safeMessage }, 400, env, req);
  }
```

**AFTER** (lines 392-421):
```javascript
  } catch (err) {
    // Provide specific error messages for common failures
    const errMsg = String(err.message || err);
    
    if (errMsg.includes("provider_key_missing")) {
      return json({ 
        error: "configuration_error", 
        message: "PROVIDER_KEY not configured. Contact system administrator." 
      }, 500, env, req);
    }
    
    if (errMsg.includes("provider_url_missing")) {
      return json({ 
        error: "configuration_error", 
        message: "PROVIDER_URL not configured. Contact system administrator." 
      }, 500, env, req);
    }
    
    if (errMsg.includes("provider_model_missing")) {
      return json({ 
        error: "configuration_error", 
        message: "PROVIDER_MODEL not configured. Contact system administrator." 
      }, 500, env, req);
    }
    
    if (errMsg.includes("provider_http_")) {
      const status = errMsg.match(/provider_http_(\d+)/)?.[1] || "unknown";
      return json({ 
        error: "provider_error", 
        message: `AI provider returned error status: ${status}` 
      }, 502, env, req);
    }
    
    // Sanitize error message to avoid leaking sensitive information
    const safeMessage = String(err.message || "invalid").replace(/\s+/g, " ").slice(0, 200);
    console.error("Chat request failed:", err);
    return json({ error: "bad_request", message: safeMessage }, 400, env, req);
  }
```

**Lines Added**: 35  
**Lines Removed**: 2  
**Impact**: Clear, actionable error messages for different failure scenarios

---

## File 2: assets/chat/config.json

### Patch 2.1: Fix Worker URL
**Location**: Line 6  
**Reason**: Clarify URL structure, remove redundant /chat suffix  

**BEFORE**:
```json
{
  "version": "2025-10-14",
  "schemaVersion": "coach-v2",
  "model": "llama-3.1-8b-instant",

  "workerUrl": "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat",
  "stream": false,
```

**AFTER**:
```json
{
  "version": "2025-10-14",
  "schemaVersion": "coach-v2",
  "model": "llama-3.1-8b-instant",

  "workerUrl": "https://my-chat-agent-v2.tonyabdelmalak.workers.dev",
  "stream": false,
```

**Lines Modified**: 1  
**Impact**: Clearer intent, widget.js getWorkerBase() doesn't need to strip suffix

---

## Summary of Changes

### Total Changes
- **Files Modified**: 2
- **Functions Modified**: 3
  - `providerChat()`
  - `postChat()`
  - `processChatRequest()`
- **Lines Added**: 65
- **Lines Removed**: 2
- **Lines Modified**: 2
- **Net Lines Changed**: +63

### Change Categories
1. **Input Validation**: 21 lines
2. **Error Handling**: 35 lines
3. **System Prompt Support**: 7 lines
4. **Configuration**: 1 line

### Testing Impact
All changes are backward compatible:
- Existing requests without systemPrompts still work
- Empty systemPrompts array is default
- New validations only trigger when environment is misconfigured
- Enhanced errors provide clearer messages than before

### Performance Impact
- Minimal: +3 validation checks per request
- Negligible overhead: < 1ms per request
- No additional API calls
- No database queries added

### Security Impact
- Improved: Catches configuration errors early
- Improved: Better error messages without leaking secrets
- No change: CORS, authentication unchanged
- No change: Input sanitization unchanged

---

## Deployment Notes

### Pre-Deployment
1. Review all patches above
2. Ensure GROQ API key is ready
3. Test wrangler CLI access

### During Deployment
```bash
# Set secret first (critical!)
wrangler secret put PROVIDER_KEY

# Deploy code
wrangler deploy

# Verify immediately
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

### Post-Deployment
1. Test from GitHub Pages
2. Verify system.md content affects responses
3. Monitor error logs for first hour
4. Check response times haven't increased

---

## Validation Criteria

Each patch should result in:
- ✅ No 502 errors when PROVIDER_KEY is set
- ✅ Clear 500 error when PROVIDER_KEY is missing
- ✅ No TypeError crashes
- ✅ Clear 422 error when plan has no facts
- ✅ System prompts visible in AI responses
- ✅ No breaking changes to existing functionality

---

## Rollback Instructions

If issues arise after deployment:

```bash
# Quick rollback
git revert ef83a27  # (replace with actual commit hash)
wrangler deploy

# Or manual rollback
git checkout HEAD~1 worker.js assets/chat/config.json
wrangler deploy
git checkout HEAD worker.js assets/chat/config.json
```

**Note**: After rollback, old issues return:
- 502 errors instead of clear messages
- Possible crashes on empty facts
- System.md not used

Consider fixing issues forward rather than rolling back.
