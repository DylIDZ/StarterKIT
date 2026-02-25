import Redis from "ioredis";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface CacheSetOptions {
    ttl?: number; // Time-to-live in seconds
}

// ─── Cache Manager Singleton ────────────────────────────────────────

const logger = pino({ name: "cache" });

class CacheManager {
    private static instance: CacheManager;
    private client: Redis | null = null;

    private constructor() { }

    static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    getClient(): Redis {
        if (!this.client) {
            const redisUrl = env.REDIS_URL || "redis://localhost:6379";
            logger.info({ url: redisUrl.replace(/\/\/.*@/, "//***@") }, "Initializing Redis client");

            this.client = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy(times: number) {
                    if (times > 5) return null; // Stop retrying after 5 attempts
                    return Math.min(times * 200, 2000);
                },
                lazyConnect: true,
            });

            this.client.on("error", (err) => {
                logger.error({ err }, "Redis connection error");
            });

            this.client.on("connect", () => {
                logger.info("Redis connected");
            });
        }
        return this.client;
    }

    /**
     * Connect to Redis (call on app startup if needed).
     */
    async connect(): Promise<void> {
        await this.getClient().connect();
    }

    /**
     * Get a cached value by key.
     */
    async get<T = unknown>(key: string): Promise<T | null> {
        try {
            const data = await this.getClient().get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            logger.error({ error, key }, "Cache get error");
            return null;
        }
    }

    /**
     * Set a value in cache.
     */
    async set(key: string, value: unknown, options: CacheSetOptions = {}): Promise<void> {
        try {
            const serialized = JSON.stringify(value);
            if (options.ttl) {
                await this.getClient().setex(key, options.ttl, serialized);
            } else {
                await this.getClient().set(key, serialized);
            }
        } catch (error) {
            logger.error({ error, key }, "Cache set error");
        }
    }

    /**
     * Delete a key from cache.
     */
    async del(key: string | string[]): Promise<number> {
        try {
            const keys = Array.isArray(key) ? key : [key];
            return await this.getClient().del(...keys);
        } catch (error) {
            logger.error({ error, key }, "Cache delete error");
            return 0;
        }
    }

    /**
     * Flush all keys in the current database.
     */
    async flush(): Promise<void> {
        try {
            await this.getClient().flushdb();
            logger.info("Cache flushed");
        } catch (error) {
            logger.error({ error }, "Cache flush error");
        }
    }

    /**
     * Cache-aside pattern: Get from cache, or compute + store.
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        options: CacheSetOptions = { ttl: 300 },
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) return cached;

        const value = await factory();
        await this.set(key, value, options);
        return value;
    }

    /**
     * Delete keys matching a pattern (use with caution).
     */
    async delByPattern(pattern: string): Promise<number> {
        try {
            let cursor = "0";
            let deleted = 0;

            do {
                const [nextCursor, keys] = await this.getClient().scan(
                    cursor,
                    "MATCH",
                    pattern,
                    "COUNT",
                    100,
                );
                cursor = nextCursor;
                if (keys.length > 0) {
                    deleted += await this.getClient().del(...keys);
                }
            } while (cursor !== "0");

            return deleted;
        } catch (error) {
            logger.error({ error, pattern }, "Cache delete by pattern error");
            return 0;
        }
    }

    /**
     * Disconnect Redis client.
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            logger.info("Redis disconnected");
        }
    }
}

export const cacheManager = CacheManager.getInstance();
