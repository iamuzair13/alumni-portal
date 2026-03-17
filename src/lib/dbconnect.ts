import "server-only";
import postgres from 'postgres'

// Lazy initialization to prevent build-time errors when DATABASE_URL is not set
let sqlInstance: ReturnType<typeof postgres> | null = null;

function initSql() {
  if (sqlInstance) return sqlInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  sqlInstance = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30, // Increased from 10 to 30 seconds
    max_lifetime: 60 * 30, // 30 minutes
    prepare: false, // Disable prepared statements for better connection handling
  });

  return sqlInstance;
}

// Create a single connection pool with increased timeouts
// Initialize lazily to prevent build-time errors
export const sql = new Proxy((() => {}) as unknown as ReturnType<typeof postgres>, {
  apply(_target, _thisArg, argArray) {
    const client = initSql() as any;
    return client(...argArray);
  },
  get(_target, prop) {
    const client = initSql() as any;
    return client[prop];
  },
}) as unknown as ReturnType<typeof postgres>;

/**
 * Retry a database operation with exponential backoff
 * @param operation The database operation to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in milliseconds (default: 1000)
 * @returns The result of the operation
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection timeout error
      const isConnectionError = error instanceof Error && (
        error.message.includes('CONNECT_TIMEOUT') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('timeout') ||
        (error as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
        (error as Error & { code?: string }).code === 'ETIMEDOUT'
      );
      
      // Only retry on connection errors
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
