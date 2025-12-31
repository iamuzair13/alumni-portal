import { NextRequest, NextResponse } from 'next/server';
export function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://alumni.uol.edu.pk',
    'http://alumni.uol.edu.pk',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  // For external public APIs, be permissive but secure
  let corsOrigin = '*';
  
  if (origin) {
    const normalizedOrigin = origin.toLowerCase().trim();
    
    // Check if origin matches any allowed origin (case-insensitive)
    const matchedOrigin = allowedOrigins.find(allowed => 
      allowed.toLowerCase() === normalizedOrigin
    );
    
    if (matchedOrigin) {
      // Use the original case from the request
      corsOrigin = origin;
    } else {
      // For development, allow localhost and 127.0.0.1
      if (process.env.NODE_ENV === 'development' && 
          (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1'))) {
        corsOrigin = origin;
      } else if (normalizedOrigin.includes('uol.edu.pk')) {
        // Allow any uol.edu.pk subdomain
        corsOrigin = origin;
      } else {
        // For unknown origins, use wildcard (public API)
        corsOrigin = '*';
      }
    }
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // Only set credentials header if not using wildcard
  if (corsOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'false';
  }

  return headers;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflight(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  
  // Log for debugging
  console.log('[CORS] Preflight request from origin:', origin);
  console.log('[CORS] Headers:', headers);
  
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  
  // Add CORS headers to existing headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[CORS] Added headers for origin:', origin);
  }
  
  return response;
}

