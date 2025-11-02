# Integration Examples

This document provides practical examples for integrating Phase B EI payloads into your application.

## Quick Start

### Enable EI in a Chat Request

```bash
curl -X POST https://my-chat-agent-v2.workers.dev/chat?emitEi=true \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "What are the key benefits of PrEP?",
    "disease": "HIV",
    "persona": "Primary Care Physician",
    "goal": "Educate on PrEP benefits",
    "session": "user-session-123"
  }'
```

### Response with EI Payload

```json
{
  "reply": "PrEP offers substantial HIV prevention...",
  "coach": {
    "overall": 85,
    "scores": {
      "accuracy": 4,
      "compliance": 4,
      "discovery": 4,
      "clarity": 4,
      "objection_handling": 3,
      "empathy": 4
    },
    "worked": ["Tied guidance to facts"],
    "improve": ["End with one specific discovery question"],
    "phrasing": "Would confirming eGFR help?",
    "feedback": "Stay concise. Cite label-aligned facts.",
    "context": {
      "rep_question": "What are the key benefits of PrEP?",
      "hcp_reply": "PrEP offers substantial HIV prevention..."
    },
    "ei": {
      "overall": 78,
      "scores": {
        "confidence": 4.2,
        "active_listening": 3.8,
        "rapport": 4.0,
        "adaptability": 3.5,
        "persistence": 3.7
      },
      "insights": [
        "Strong knowledge-based confidence demonstrated",
        "Empathetic and collaborative tone maintained"
      ],
      "recommendations": [
        "End with a discovery question to show flexibility",
        "Include specific next steps or timeframe for follow-up"
      ]
    }
  },
  "plan": {
    "id": "abc123def456"
  }
}
```

## Frontend Integration

### React Example

```javascript
import React, { useState } from 'react';

function ChatWithEI() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState(null);
  const [eiEnabled, setEiEnabled] = useState(true);

  const sendMessage = async () => {
    const url = eiEnabled 
      ? '/chat?emitEi=true' 
      : '/chat';
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'sales-simulation',
        user: message,
        disease: 'HIV',
        persona: 'Primary Care Physician',
        goal: 'Educate on PrEP'
      })
    });
    
    const data = await res.json();
    setResponse(data);
  };

  return (
    <div>
      <label>
        <input 
          type="checkbox" 
          checked={eiEnabled}
          onChange={(e) => setEiEnabled(e.target.checked)}
        />
        Enable EI Scoring
      </label>
      
      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your question..."
      />
      
      <button onClick={sendMessage}>Send</button>
      
      {response && (
        <div>
          <h3>Reply:</h3>
          <p>{response.reply}</p>
          
          {response.coach?.ei && (
            <div className="ei-panel">
              <h3>Emotional Intelligence</h3>
              <div className="ei-overall">
                Overall Score: {response.coach.ei.overall}/100
              </div>
              
              <h4>Detailed Scores:</h4>
              <ul>
                <li>Confidence: {response.coach.ei.scores.confidence}/5</li>
                <li>Active Listening: {response.coach.ei.scores.active_listening}/5</li>
                <li>Rapport: {response.coach.ei.scores.rapport}/5</li>
                <li>Adaptability: {response.coach.ei.scores.adaptability}/5</li>
                <li>Persistence: {response.coach.ei.scores.persistence}/5</li>
              </ul>
              
              <h4>Insights:</h4>
              <ul>
                {response.coach.ei.insights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
              
              <h4>Recommendations:</h4>
              <ul>
                {response.coach.ei.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatWithEI;
```

### Vue.js Example

```vue
<template>
  <div class="chat-with-ei">
    <div class="controls">
      <label>
        <input 
          type="checkbox" 
          v-model="eiEnabled"
        />
        Enable EI Scoring
      </label>
    </div>
    
    <textarea 
      v-model="message"
      placeholder="Type your question..."
    />
    
    <button @click="sendMessage">Send</button>
    
    <div v-if="response" class="response">
      <h3>Reply:</h3>
      <p>{{ response.reply }}</p>
      
      <div v-if="response.coach?.ei" class="ei-panel">
        <h3>Emotional Intelligence</h3>
        <div class="ei-overall">
          Overall Score: {{ response.coach.ei.overall }}/100
        </div>
        
        <h4>Detailed Scores:</h4>
        <div class="ei-scores">
          <div v-for="(value, key) in response.coach.ei.scores" :key="key">
            {{ formatLabel(key) }}: {{ value }}/5
          </div>
        </div>
        
        <h4>Insights:</h4>
        <ul>
          <li v-for="(insight, i) in response.coach.ei.insights" :key="i">
            {{ insight }}
          </li>
        </ul>
        
        <h4>Recommendations:</h4>
        <ul>
          <li v-for="(rec, i) in response.coach.ei.recommendations" :key="i">
            {{ rec }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      message: '',
      response: null,
      eiEnabled: true
    };
  },
  methods: {
    async sendMessage() {
      const url = this.eiEnabled ? '/chat?emitEi=true' : '/chat';
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sales-simulation',
          user: this.message,
          disease: 'HIV',
          persona: 'Primary Care Physician',
          goal: 'Educate on PrEP'
        })
      });
      
      this.response = await res.json();
    },
    formatLabel(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
};
</script>
```

## Server-Sent Events (SSE) Integration

### JavaScript SSE Client

```javascript
async function chatWithSSE(message, eiEnabled = true) {
  const url = eiEnabled ? '/chat?emitEi=true' : '/chat';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      mode: 'sales-simulation',
      user: message,
      disease: 'HIV'
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const eventType = line.substring(7).split('\n')[0];
        const dataLine = line.split('\ndata: ')[1];
        
        if (dataLine) {
          const data = JSON.parse(dataLine);
          
          if (eventType === 'coach.partial') {
            console.log('Partial update:', data);
            // Update UI with partial data
          } else if (eventType === 'coach.final') {
            console.log('Final result:', data);
            // Update UI with final result including EI
            return data;
          } else if (eventType === 'error') {
            console.error('Error:', data);
            throw new Error(data.detail);
          }
        }
      }
    }
  }
}

// Usage
chatWithSSE('What are the safety considerations for PrEP?', true)
  .then(result => {
    console.log('Final reply:', result.reply);
    if (result.coach?.ei) {
      console.log('EI Overall:', result.coach.ei.overall);
      console.log('EI Scores:', result.coach.ei.scores);
    }
  })
  .catch(error => {
    console.error('Chat failed:', error);
  });
```

### React SSE Hook

```javascript
import { useState, useCallback } from 'react';

function useSSEChat() {
  const [loading, setLoading] = useState(false);
  const [partial, setPartial] = useState(null);
  const [final, setFinal] = useState(null);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (message, options = {}) => {
    const { eiEnabled = true, mode = 'sales-simulation' } = options;
    
    setLoading(true);
    setPartial(null);
    setFinal(null);
    setError(null);

    try {
      const url = eiEnabled ? '/chat?emitEi=true' : '/chat';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          mode,
          user: message,
          disease: 'HIV'
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.substring(7).split('\n')[0];
            const dataLine = line.split('\ndata: ')[1];
            
            if (dataLine) {
              const data = JSON.parse(dataLine);
              
              if (eventType === 'coach.partial') {
                setPartial(data);
              } else if (eventType === 'coach.final') {
                setFinal(data);
                setLoading(false);
              } else if (eventType === 'error') {
                setError(data);
                setLoading(false);
              }
            }
          }
        }
      }
    } catch (err) {
      setError({ error: 'request_failed', detail: err.message });
      setLoading(false);
    }
  }, []);

  return { sendMessage, loading, partial, final, error };
}

// Usage in component
function ChatComponent() {
  const { sendMessage, loading, partial, final, error } = useSSEChat();
  const [message, setMessage] = useState('');

  const handleSend = () => {
    sendMessage(message, { eiEnabled: true });
  };

  return (
    <div>
      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
      
      {partial && <div>Progress: {partial.progress}%</div>}
      
      {final && (
        <div>
          <p>{final.reply}</p>
          {final.coach?.ei && (
            <div>
              <h4>EI Score: {final.coach.ei.overall}/100</h4>
              {/* Render EI details */}
            </div>
          )}
        </div>
      )}
      
      {error && <div className="error">{error.detail}</div>}
    </div>
  );
}
```

## Python Integration

```python
import requests
import json

def chat_with_ei(message, ei_enabled=True, mode='sales-simulation'):
    """
    Send a chat message and optionally request EI scoring
    """
    url = 'https://my-chat-agent-v2.workers.dev/chat'
    
    # Add query parameter if EI is enabled
    if ei_enabled:
        url += '?emitEi=true'
    
    payload = {
        'mode': mode,
        'user': message,
        'disease': 'HIV',
        'persona': 'Primary Care Physician',
        'goal': 'Educate on PrEP',
        'session': 'python-session-123'
    }
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    
    return response.json()

# Usage
result = chat_with_ei('What are the key benefits of PrEP?', ei_enabled=True)

print(f"Reply: {result['reply']}")

if 'coach' in result and 'ei' in result['coach']:
    ei = result['coach']['ei']
    print(f"\nEI Overall Score: {ei['overall']}/100")
    print("\nEI Detailed Scores:")
    for dimension, score in ei['scores'].items():
        print(f"  {dimension}: {score}/5")
    
    print("\nInsights:")
    for insight in ei['insights']:
        print(f"  - {insight}")
    
    print("\nRecommendations:")
    for rec in ei['recommendations']:
        print(f"  - {rec}")
```

## Node.js/Express Backend Integration

```javascript
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Proxy endpoint that adds EI based on user preference
app.post('/api/chat', async (req, res) => {
  try {
    const { message, eiEnabled = false } = req.body;
    
    // Forward to worker with EI flag
    const workerUrl = eiEnabled 
      ? 'https://my-chat-agent-v2.workers.dev/chat?emitEi=true'
      : 'https://my-chat-agent-v2.workers.dev/chat';
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'sales-simulation',
        user: message,
        disease: 'HIV',
        session: req.session?.id || 'anonymous'
      })
    });
    
    const data = await response.json();
    
    // Optionally transform or enrich the response
    if (data.coach?.ei) {
      // Log EI metrics (without PHI)
      console.log('EI Score:', data.coach.ei.overall);
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'chat_failed', 
      detail: error.message 
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Monitoring and Analytics

### Track EI Metrics

```javascript
// Fetch metrics endpoint
async function getMetrics() {
  const response = await fetch('https://my-chat-agent-v2.workers.dev/metrics');
  const metrics = await response.json();
  
  console.log('Total chat requests:', metrics.counters.chat_requests_total);
  console.log('Requests with EI:', metrics.counters.chat_requests_with_ei);
  console.log('EI computations:', metrics.counters.ei_computations_total);
  
  console.log('Avg EI score:', metrics.histograms.ei_score.avg);
  console.log('Avg computation time:', metrics.histograms.ei_computation_duration_ms.avg, 'ms');
  
  return metrics;
}
```

### Dashboard Integration

```javascript
// Example: Send EI data to analytics service
async function trackEIAnalytics(eiData) {
  // Only send aggregated, non-PHI data
  const analyticsPayload = {
    overall_score: eiData.overall,
    confidence_score: eiData.scores.confidence,
    active_listening_score: eiData.scores.active_listening,
    rapport_score: eiData.scores.rapport,
    adaptability_score: eiData.scores.adaptability,
    persistence_score: eiData.scores.persistence,
    insight_count: eiData.insights.length,
    recommendation_count: eiData.recommendations.length,
    timestamp: new Date().toISOString()
  };
  
  // Send to your analytics service
  await fetch('https://analytics.example.com/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'ei_computed',
      properties: analyticsPayload
    })
  });
}
```

## Testing

### cURL Test Suite

```bash
#!/bin/bash

# Test 1: Basic chat without EI
echo "Test 1: Basic chat without EI"
curl -X POST https://my-chat-agent-v2.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "Tell me about PrEP"
  }' | jq '.coach.ei // "No EI"'

echo ""

# Test 2: Chat with EI via query param
echo "Test 2: Chat with EI via query param"
curl -X POST "https://my-chat-agent-v2.workers.dev/chat?emitEi=true" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "Tell me about PrEP safety"
  }' | jq '.coach.ei.overall'

echo ""

# Test 3: Chat with EI via header
echo "Test 3: Chat with EI via header"
curl -X POST https://my-chat-agent-v2.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "X-Emit-EI: true" \
  -d '{
    "mode": "sales-simulation",
    "user": "What are the benefits?"
  }' | jq '.coach.ei.scores'

echo ""

# Test 4: Metrics endpoint
echo "Test 4: Metrics endpoint"
curl -X GET https://my-chat-agent-v2.workers.dev/metrics | jq '.counters'
```

## Best Practices

1. **Feature Flag Management**: Use query parameters during development, headers in production
2. **Performance**: EI adds 5-15ms overhead - acceptable for most use cases
3. **Privacy**: Never log raw user input; use redacted metrics only
4. **Backward Compatibility**: Always check for `ei` field existence before rendering
5. **Error Handling**: Gracefully handle cases where EI computation fails
6. **SSE**: Use SSE for long conversations or when progressive rendering is needed
7. **Metrics**: Monitor EI score distributions to identify training opportunities

## Troubleshooting

### EI Field Not Appearing

Check:
1. Is `emitEi=true` in query params or `X-Emit-EI: true` in headers?
2. Is mode set to `sales-simulation`? (EI only works in this mode)
3. Check browser console for CORS errors

### Low EI Scores

Review:
1. Are responses using facts and clinical data? (improves confidence)
2. Are responses acknowledging user concerns? (improves active listening)
3. Do responses end with questions? (improves adaptability)
4. Are responses using empathetic language? (improves rapport)

### SSE Not Working

Verify:
1. Accept header is set to `text/event-stream`
2. Browser supports SSE (all modern browsers do)
3. CORS headers allow streaming responses
