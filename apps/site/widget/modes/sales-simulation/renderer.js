/**
 * Sales Simulation Renderer
 * Renders responses with 4 sections: Challenge, Rep Approach, Impact, Suggested Phrasing
 * Accepts both structured JSON and labeled text formats
 */

import { createElement, createSection } from '../../core/ui.js';
import { validateSalesSim } from '../../core/guards.js';
import { bus } from '../../core/bus.js';

/**
 * Section order and display names
 */
const SECTIONS = [
  { key: 'challenge', title: 'Challenge' },
  { key: 'rep_approach', title: 'Rep Approach' },
  { key: 'impact', title: 'Impact' },
  { key: 'suggested_phrasing', title: 'Suggested Phrasing' }
];

/**
 * Render sales simulation response
 */
export function renderSalesSimulation(response, container) {
  if (!container) {
    console.error('Sales Sim: No container provided');
    return;
  }

  // Clear container
  container.innerHTML = '';

  // Validate and parse response
  const validation = validateSalesSim(response);
  
  if (!validation.valid) {
    // Show partial response with warning
    renderPartialResponse(validation.data, validation.missing, container);
    return;
  }

  // Render all sections in order
  SECTIONS.forEach(({ key, title }) => {
    const content = validation.data[key];
    if (content && String(content).trim()) {
      const section = createSalesSimSection(title, content);
      container.appendChild(section);
    }
  });

  bus.emit('renderer:sales-sim:complete', {
    format: validation.format,
    sectionCount: SECTIONS.length
  });
}

/**
 * Create a formatted section for sales simulation
 */
function createSalesSimSection(title, content) {
  const section = createElement('div', {
    className: 'sales-sim-section',
    'data-section': title.toLowerCase().replace(/\s+/g, '-')
  });

  // Header
  const header = createElement('h3', {
    className: 'sales-sim-header',
    textContent: title
  });
  section.appendChild(header);

  // Content
  const body = createElement('div', {
    className: 'sales-sim-body'
  });

  // Parse and format content
  const formattedContent = formatSectionContent(content, title);
  body.innerHTML = formattedContent;

  section.appendChild(body);

  return section;
}

/**
 * Format section content based on type
 */
function formatSectionContent(content, sectionTitle) {
  let text = String(content || '').trim();

  // Remove any residual section labels
  text = text.replace(/^(Challenge|Rep\s*Approach|Impact|Suggested\s*Phrasing)\s*[:：]\s*/i, '');
  text = text.replace(/^\*\*(Challenge|Rep\s*Approach|Impact|Suggested\s*Phrasing)\*\*\s*[:：]?\s*/i, '');

  // For Suggested Phrasing, format as a callout
  if (sectionTitle === 'Suggested Phrasing') {
    // Check if it's a list
    if (text.includes('\n-') || text.includes('\n*') || text.includes('\n•')) {
      // Already formatted as list - sanitize and convert
      const items = text
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
            // Use textContent equivalent for security
            const content = trimmed.slice(1).trim();
            return `<li>${escapeHTML(content)}</li>`;
          }
          return trimmed ? `<p>${escapeHTML(trimmed)}</p>` : '';
        })
        .filter(Boolean)
        .join('');
      
      if (items.includes('<li>')) {
        text = `<ul class="phrasing-list">${items}</ul>`;
      }
    } else {
      // Single phrase or paragraph
      text = `<p class="phrasing-suggestion">"${escapeHTML(text)}"</p>`;
    }
  } else {
    // Standard formatting for other sections - parse markdown safely
    text = parseMarkdownSafe(text);
    
    // Wrap paragraphs
    const paragraphs = text.split('<br><br>').filter(p => p.trim());
    if (paragraphs.length > 1) {
      text = paragraphs.map(p => `<p>${p}</p>`).join('');
    } else {
      text = `<p>${text}</p>`;
    }
  }

  return text;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse markdown safely with HTML escaping
 */
function parseMarkdownSafe(text) {
  const escaped = escapeHTML(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/**
 * Render partial response with warning for missing sections
 */
function renderPartialResponse(data, missing, container) {
  // Warning banner
  const warning = createElement('div', {
    className: 'sales-sim-warning',
    innerHTML: `
      <strong>⚠ Incomplete Response</strong><br>
      Missing sections: ${missing.map(m => 
        m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      ).join(', ')}
    `
  });
  container.appendChild(warning);

  // Render available sections
  SECTIONS.forEach(({ key, title }) => {
    const content = data && data[key];
    if (content && String(content).trim()) {
      const section = createSalesSimSection(title, content);
      container.appendChild(section);
    } else {
      // Placeholder for missing section
      const placeholder = createElement('div', {
        className: 'sales-sim-section sales-sim-missing',
        innerHTML: `
          <h3 class="sales-sim-header">${title}</h3>
          <div class="sales-sim-body">
            <p class="missing-placeholder">Section not provided</p>
          </div>
        `
      });
      container.appendChild(placeholder);
    }
  });

  bus.emit('renderer:sales-sim:partial', {
    missing,
    provided: SECTIONS.filter(s => data && data[s.key]).length
  });
}

/**
 * Extract sales simulation data from raw text
 * Handles both JSON and labeled text formats
 */
export function extractSalesSimData(text) {
  const str = String(text || '').trim();
  
  // Try JSON first
  const jsonMatch = str.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Fall through
    }
  }

  // Parse labeled text
  const data = {};
  let currentSection = null;
  let currentContent = [];

  const lines = str.split('\n');
  
  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Check for section headers
    const headerMatch = trimmed.match(/^(?:\*\*)?(?:#{1,3}\s*)?(Challenge|Rep\s*Approach|Impact|Suggested\s*Phrasing)(?:\*\*)?[:：]?\s*/i);
    
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        const key = normalizeKey(currentSection);
        data[key] = currentContent.join('\n').trim();
      }
      
      // Start new section
      currentSection = headerMatch[1];
      currentContent = [];
      
      // Get content after header
      const content = trimmed.replace(headerMatch[0], '').trim();
      if (content) {
        currentContent.push(content);
      }
    } else if (currentSection && trimmed) {
      currentContent.push(trimmed);
    }
  });

  // Save last section
  if (currentSection) {
    const key = normalizeKey(currentSection);
    data[key] = currentContent.join('\n').trim();
  }

  return data;
}

/**
 * Normalize section key
 */
function normalizeKey(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Create empty sales simulation template
 */
export function createEmptyTemplate() {
  return {
    challenge: '',
    rep_approach: '',
    impact: '',
    suggested_phrasing: ''
  };
}
