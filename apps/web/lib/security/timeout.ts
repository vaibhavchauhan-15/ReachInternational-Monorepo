import "server-only";

/**
 * ReachInternational Server Action & Query Timeout Guard (LPDoS Protection)
 * Wraps server execution logic in a 10-second AbortController timeout guard,
 * preventing slow HTTP connections or hanging queries from locking server resources.
 */

export const DEFAULT_SERVER_TIMEOUT_MS = 10000; // 10 seconds timeout limit

export class RequestTimeoutError extends Error {
  constructor(message = "Server request execution timed out after 10000ms") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

/**
 * Wraps an async function with an execution timeout guard.
 */
export async function withExecutionTimeout<T>(
  asyncTask: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_SERVER_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await Promise.race([
      asyncTask(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new RequestTimeoutError(`Operation timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
