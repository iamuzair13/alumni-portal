import "server-only";
import postgres from 'postgres'

// ─── Dev-only query statistics (T0.2 perf baseline) ──────────────────────────
// Enabled with DB_QUERY_STATS=1. Counts every query actually sent to Postgres
// via the driver's `debug` hook (zero semantic change — fragments composed but
// never executed are not counted). Read/reset via getDbQueryStats() /
// resetDbQueryStats() (e.g. from the dev-only /api/dev/perf-stats route).
type QueryStats = { count: number; totalMs: number; entries: { text: string; ms: number; at: number }[] };
const statsState = (): QueryStats => {
  const g = globalThis as { __dbQueryStats?: QueryStats };
  if (!g.__dbQueryStats) g.__dbQueryStats = { count: 0, totalMs: 0, entries: [] };
  return g.__dbQueryStats;
};
const STATS_ENABLED = () => process.env.DB_QUERY_STATS === "1";
function recordQuery(text: string) {
  const s = statsState();
  s.count += 1;
  if (s.entries.length < 5000) s.entries.push({ text: text.slice(0, 300), ms: 0, at: Date.now() });
}
export function getDbQueryStats(): QueryStats {
  return statsState();
}
export function resetDbQueryStats(): void {
  const s = statsState();
  s.count = 0;
  s.totalMs = 0;
  s.entries = [];
}

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
    // Driver-level hook fires only for queries actually sent to Postgres —
    // fragments composed into a larger query are never counted.
    debug: STATS_ENABLED()
      ? (_conn: number, query: string) => recordQuery(String(query))
      : undefined,
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
