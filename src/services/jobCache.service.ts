import { cached, readVersion, bumpVersion, type CacheResult } from "../lib/cache.js";

const NAMESPACE = "jobs";

export const JOB_LIST_TTL_SECONDS = 60;
export const JOB_DETAIL_TTL_SECONDS = 120;

export async function cachedJobs<T>(
  keyPart: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<CacheResult<T>> {
  const version = await readVersion(NAMESPACE);

  if (version === null) {
    return { data: await fetcher(), status: "BYPASS" }; 
  }

  return cached(`${NAMESPACE}:v${version}:${keyPart}`, ttlSeconds, fetcher);
}

export function invalidateJobCaches(): Promise<void> {
  return bumpVersion(NAMESPACE);
}