interface FetchRetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryStatusCodes?: number[];
}

const DEFAULT_RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (retryAfter: string | null): number | null => {
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number | undefined
) => {
  if (!timeoutMs || timeoutMs <= 0 || init?.signal) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const getBackoffDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number) => {
  const raw = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.random() * Math.min(250, baseDelayMs);
  return raw + jitter;
};

export const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {}
): Promise<Response> => {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const timeoutMs = options.timeoutMs;
  const retryStatusCodes = new Set(options.retryStatusCodes ?? DEFAULT_RETRY_STATUS_CODES);

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(input, init, timeoutMs);
      if (res.ok || !retryStatusCodes.has(res.status) || attempt === retries) {
        return res;
      }

      const retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'));
      const delayMs =
        retryAfterMs !== null
          ? Math.min(maxDelayMs, retryAfterMs)
          : getBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      await sleep(delayMs);
      attempt += 1;
      continue;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
      const delayMs = getBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed');
};
