import IORedis from "ioredis";

// Singleton Redis client — survives Next.js hot reloads in development.
// maxRetriesPerRequest: null is required for BullMQ compatibility.
const globalForRedis = globalThis as unknown as {
  _redisClient: IORedis | undefined;
};

if (!globalForRedis._redisClient) {
  globalForRedis._redisClient = new IORedis(
    process.env.REDIS_URL ?? "redis://localhost:6379",
    { maxRetriesPerRequest: null }
  );
}

const redis = globalForRedis._redisClient;
export default redis;
