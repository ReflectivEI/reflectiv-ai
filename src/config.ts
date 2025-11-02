import { Config } from './types';

/**
 * Parse emitEi flag from request query parameters or headers
 * Query: ?emitEi=true or ?emitEi=1
 * Header: x-ei-emit: 1
 */
export function fromRequest(req: Request): Config {
  const url = new URL(req.url);
  
  // Check query parameter
  const queryParam = url.searchParams.get('emitEi');
  if (queryParam === 'true' || queryParam === '1') {
    return { emitEi: true };
  }
  
  // Check header
  const headerValue = req.headers.get('x-ei-emit');
  if (headerValue === '1') {
    return { emitEi: true };
  }
  
  return { emitEi: false };
}
