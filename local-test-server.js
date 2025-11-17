#!/usr/bin/env node

/**
 * Local Development Server for Widget Testing
 * 
 * Provides a localhost server to:
 * 1. Serve widget files (HTML, JS, CSS) for browser testing
 * 2. Proxy API calls to the worker (or use mock worker if unavailable)
 * 3. Enable real browser testing of widget functionality
 * 
 * Usage:
 *   node local-test-server.js [--port 8080] [--mock]
 * 
 * Options:
 *   --port    Port to listen on (default: 8080)
 *   --mock    Use mock worker responses instead of real worker
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const useMock = args.includes('--mock');

const PORT = portArg ? parseInt(portArg.split('=')[1]) : 8080;
const WORKER_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev';

// MIME types for serving static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Mock worker responses for offline testing
 */
function getMockWorkerResponse(mode, message) {
  const responses = {
    'sales-coach': {
      reply: `**Challenge:** The HCP is expressing interest in the topic.\n\n**Rep Approach:** Acknowledge their question and provide evidence-based information.\n\n**HCP Likely Response:** They may ask follow-up questions about specific aspects.`,
      coach: {
        overall: 4,
        scores: {
          clarity: 4,
          empathy: 4,
          evidence: 4,
          compliance: 5
        }
      },
      plan: {
        id: 'test-plan-001',
        next: 'Provide clinical data',
        rationale: 'Build credibility with evidence'
      }
    },
    'role-play': {
      reply: `I appreciate you taking the time to discuss this with me. As a busy practitioner, I'm always looking for evidence-based approaches. What specific aspects would you like to explore?`,
      coach: null,
      plan: null
    },
    'product-knowledge': {
      reply: `Based on current clinical guidelines and product information:\n\n1. **Indication**: The indication for this therapy includes...\n2. **Key Points**: Important considerations are...\n3. **References**: [Clinical data supports this use]`,
      coach: null,
      plan: null
    },
    'emotional-assessment': {
      reply: `Based on your message, I'm noticing:\n\n**Empathy Level**: 4/5 - You show good understanding\n**Stress Indicators**: Moderate - Consider pacing\n**Active Listening**: Strong - You're asking good questions\n\n**Tips for improvement**:\n- Continue to validate their concerns\n- Use open-ended questions`,
      coach: null,
      plan: null
    }
  };

  return responses[mode] || responses['sales-coach'];
}

/**
 * Proxy request to actual worker
 */
function proxyToWorker(payload, callback) {
  const data = JSON.stringify(payload);
  const url = new URL(WORKER_URL + '/chat');
  
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Origin': 'http://localhost:' + PORT
    },
    timeout: 30000
  };

  console.log(`[PROXY] Forwarding to ${WORKER_URL}/chat`);
  
  const req = https.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log(`[PROXY] Worker responded with status ${res.statusCode}`);
      try {
        callback(null, {
          status: res.statusCode,
          headers: res.headers,
          data: JSON.parse(responseData)
        });
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on('error', (error) => {
    console.error(`[PROXY] Worker error:`, error.message);
    callback(error, null);
  });
  
  req.on('timeout', () => {
    req.destroy();
    callback(new Error('Worker timeout'), null);
  });

  req.write(data);
  req.end();
}

/**
 * Handle API requests (/chat endpoint)
 */
function handleApiRequest(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      console.log(`[API] Chat request for mode: ${payload.mode}`);
      
      if (useMock) {
        // Use mock response
        console.log('[API] Using mock worker response');
        const mockData = getMockWorkerResponse(payload.mode, payload.messages[0]?.content);
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        res.end(JSON.stringify(mockData));
      } else {
        // Proxy to real worker
        proxyToWorker(payload, (error, response) => {
          if (error) {
            res.writeHead(503, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
              error: 'Worker unavailable',
              message: error.message,
              suggestion: 'Try running with --mock flag for offline testing'
            }));
          } else {
            res.writeHead(response.status, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify(response.data));
          }
        });
      }
    } catch (error) {
      console.error('[API] Error parsing request:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request body' }));
    }
  });
}

/**
 * Serve static files
 */
function serveStaticFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

/**
 * Main request handler
 */
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Handle /chat API endpoint
  if (req.url === '/chat' && req.method === 'POST') {
    handleApiRequest(req, res);
    return;
  }
  
  // Handle /health endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  
  // Serve static files
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './widget-test.html';
  }
  
  const fullPath = path.join(__dirname, filePath);
  
  // Security check - prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  serveStaticFile(fullPath, res);
});

// Start server
server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  ReflectivAI Widget - Local Test Server                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 Server running at: http://localhost:${PORT}`);
  console.log(`  📝 Test page: http://localhost:${PORT}/widget-test.html`);
  console.log(`  🔧 Mode: ${useMock ? 'MOCK (offline)' : 'PROXY (to worker)'}`);
  console.log(`  🎯 Worker URL: ${WORKER_URL}`);
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');
  console.log('═'.repeat(70));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n[SERVER] Shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});
