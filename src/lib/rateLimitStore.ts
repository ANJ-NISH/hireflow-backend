import { Redis } from "ioredis";

const { REDIS_URL } = process.env;

type LimiterClient = Redis & {
  rateLimitHit(key: string, windowMs: number): Promise<[number, number]>;
};

const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

const client: LimiterClient | null = REDIS_URL
  ? (new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: 300,
    }) as LimiterClient)
  : null;

client?.defineCommand("rateLimitHit", { numberOfKeys: 1, lua: HIT_SCRIPT });

let lastWarnAt = 0;
function warn(message: string, err?: unknown) {
  const now = Date.now();
  if (now - lastWarnAt < 30_000) return;
  lastWarnAt = now;
  console.warn(`[rate-limit] ${message}`, err instanceof Error ? `— ${err.message}` : "");
}

client?.on("error", (err) => warn("connection problem", err));


type Entry = { count: number; resetAt: number };
const memory = new Map<string, Entry>();
const MEMORY_MAX_KEYS = 10_000;

function evict(now: number) {
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
  if (memory.size >= MEMORY_MAX_KEYS) {
    const oldest = memory.keys().next().value; 
    if (oldest !== undefined) memory.delete(oldest);
  }
}

function memoryHit(key: string, windowMs: number): HitResult {
  const now = Date.now();
  let entry = memory.get(key);

  if (!entry || entry.resetAt <= now) {
    if (memory.size >= MEMORY_MAX_KEYS) evict(now);
    entry = { count: 0, resetAt: now + windowMs };
    memory.set(key, entry);
  }

  entry.count += 1;
  return { count: entry.count, ttlMs: entry.resetAt - now };
}


export type HitResult = { count: number; ttlMs: number };

export async function hit(key: string, windowMs: number): Promise<HitResult> {
  if (client) {
    try {
      const [count, ttlMs] = await client.rateLimitHit(key, windowMs);
      return { count, ttlMs };
    } catch (err) {
      warn("Redis unavailable, using the in-memory fallback", err);
    }
  }
  return memoryHit(key, windowMs);
}

export async function reset(key: string): Promise<void> {
  memory.delete(key);
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    warn("could not clear a counter", err);
  }
}