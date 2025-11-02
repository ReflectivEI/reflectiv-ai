/**
 * Simple bundler for Cloudflare Worker
 * Combines all TypeScript outputs into a single worker.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outputFile = path.join(rootDir, 'worker.js');

// Read the main worker file
const workerPath = path.join(distDir, 'worker.js');

if (!fs.existsSync(workerPath)) {
  console.error('Error: dist/worker.js not found. Run tsc first.');
  process.exit(1);
}

// For now, just copy the worker file since Cloudflare Workers
// support ES modules natively
console.log('Bundling worker...');

// Read all files from dist and create a simple concatenation
// In a real scenario, you'd use esbuild or similar
const workerContent = fs.readFileSync(workerPath, 'utf-8');

// Write to root worker.js
fs.writeFileSync(outputFile, workerContent);

console.log(`✓ Bundle created: ${outputFile}`);
