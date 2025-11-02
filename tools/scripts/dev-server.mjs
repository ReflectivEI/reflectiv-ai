#!/usr/bin/env node
/**
 * Simple dev server for testing the widget locally
 * Usage: node tools/scripts/dev-server.mjs [port]
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');

const PORT = parseInt(process.argv[2]) || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown'
};

const server = createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  // Remove query string
  filePath = filePath.split('?')[0];

  // Security: prevent directory traversal
  if (filePath.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const fullPath = join(ROOT, filePath);
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  try {
    const content = await readFile(fullPath);
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      console.error('Server error:', error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Dev server running at http://localhost:${PORT}/`);
  console.log(`   Serving from: ${ROOT}`);
  console.log(`\n   Press Ctrl+C to stop\n`);
});
