export type CacheKey = string;

type CacheEntry<T> = {
    value: T;
    /**
     * Unix timestamp in ms when the entry expires.
     * If null, the entry does not expire.
     */
    expiresAt: number | null;
};

export interface CacheAdapter {
    get<T>(key: CacheKey): T | undefined;
    set<T>(key: CacheKey, value: T, ttlMs?: number): void;
    delete(key: CacheKey): void;
    clear(): void;
}

class InMemoryCacheAdapter implements CacheAdapter {
    private store = new Map<CacheKey, CacheEntry<unknown>>();

    get<T>(key: CacheKey): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;

        if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }

        return entry.value as T;
    }

    set<T>(key: CacheKey, value: T, ttlMs?: number): void {
        const expiresAt = typeof ttlMs === "number" && ttlMs > 0 ? Date.now() + ttlMs : null;
        this.store.set(key, { value, expiresAt });
    }

    delete(key: CacheKey): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

/**
 * Singleton cache instance for the backend.
 * If we later switch to Redis or another backend,
 * we only need to replace this implementation.
 */
export const cache: CacheAdapter = new InMemoryCacheAdapter();

export async function getOrSet<T>(
    key: CacheKey,
    factory: () => Promise<T>,
    ttlMs?: number,
): Promise<T> {
    const cached = cache.get<T>(key);
    if (cached !== undefined) {
        return cached;
    }

    const value = await factory();
    cache.set(key, value, ttlMs);
    return value;
}
