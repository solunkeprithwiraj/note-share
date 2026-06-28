const attempts = new Map<string, number[]>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const hits = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_ATTEMPTS) {
    attempts.set(key, hits);
    return false;
  }
  hits.push(now);
  attempts.set(key, hits);
  return true;
}
