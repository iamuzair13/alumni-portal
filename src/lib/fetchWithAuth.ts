/**
 * Global fetch wrapper that handles 401 errors and session expiration
 * Automatically redirects to signin page when session expires
 */

let isRedirecting = false;

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // Handle 401 Unauthorized errors
  if (response.status === 401 && typeof window !== "undefined" && !isRedirecting) {
    isRedirecting = true;
    
    // Clear all caches
    try {
      // Clear React Query cache if available
      const queryClient = (window as { __REACT_QUERY_CLIENT__?: { clear: () => void } }).__REACT_QUERY_CLIENT__;
      if (queryClient) {
        queryClient.clear();
      }
    } catch {
      // Ignore errors
    }
    
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    
    // Redirect to signin
    window.location.href = "/signin";
    
    return response;
  }

  return response;
}

