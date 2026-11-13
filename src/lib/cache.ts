import { Redis } from "ioredis";

const { CACHE_REDIS_URL } = process.env;

const MAX_KEY_LENGTH = 512;
const WARN_EVERY_MS = 30_000;

export const cache: Redis | null = CACHE_REDIS_URL
  ? new Redis(CACHE_REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, 
      commandTimeout: 500, 
    })
  : null;

let lastWarnAt = 0;
function warn(message: string, err?: unknown) {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  console.warn(`[cache] ${message}`, err instanceof Error ? `— ${err.message}` : "");
}

if (cache) {
  cache.on("ready", () => console.log("[cache] connected"));
  cache.on("error", (err) => warn("connection problem", err));
} else {
  console.log("[cache] CACHE_REDIS_URL not set — caching disabled");
}

export type CacheStatus = "HIT" | "MISS" | "BYPASS";
export type CacheResult<T> = { data: T; status: CacheStatus };

async function bypass<T>(fetcher: () => Promise<T>): Promise<CacheResult<T>> {
  return { data: await fetcher(), status: "BYPASS" };
}

function withJitter(ttlSeconds: number): number {
  return ttlSeconds + Math.floor(Math.random() * ttlSeconds * 0.1);
}

const inFlight = new Map<string, Promise<CacheResult<unknown>>>();

async function load<T>(
  client: Redis,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<CacheResult<T>> {
  try {
    const hit = await client.get(key);
    if (hit !== null) return { data: JSON.parse(hit) as T, status: "HIT" };
  } catch (err) {
    warn("read failed, serving from the database", err);
    return bypass(fetcher);
  }

  const data = await fetcher(); 

  if (data !== null && data !== undefined) {
    try {
      await client.set(key, JSON.stringify(data), "EX", withJitter(ttlSeconds));
    } catch (err) {
      warn("write failed", err);
    }
  }

  return { data, status: "MISS" };
}

export function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<CacheResult<T>> {
  const client = cache;
  if (!client || key.length > MAX_KEY_LENGTH) return bypass(fetcher);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<CacheResult<T>>;

  const promise = load(client, key, ttlSeconds, fetcher).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export function stableKey(
  params: Record<string, unknown>,
  opts: { lowercase?: string[] } = {}
): string {
  const lower = new Set(opts.lowercase ?? []);
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]): [string, string] => [k, lower.has(k) ? String(v).toLowerCase() : String(v)])
    .sort(([a], [b]) => a.localeCompare(b));

  return new URLSearchParams(pairs).toString();
}


const versionKey = (ns: string) => `${ns}:version`;

export async function readVersion(ns: string): Promise<string | null> {
  if (!cache) return null;
  try {
    return (await cache.get(versionKey(ns))) ?? "0";
  } catch (err) {
    warn("version read failed, serving from the database", err);
    return null;
  }
}

export async function bumpVersion(ns: string): Promise<void> {
  if (!cache) return;
  try {
    await cache.incr(versionKey(ns));
  } catch (err) {
    warn("version bump failed — cached data may be stale until its TTL expires", err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!cache || keys.length === 0) return;
  try {
    await cache.del(...keys);
  } catch (err) {
    warn("delete failed", err);
  }
}