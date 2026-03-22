import IORedis from 'ioredis';

/**
 * Redis Connection Config
 * 
 * In Docker, host should be 'redis'. 
 * For local dev, defaults to 'localhost'.
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null, // Required by BullMQ
};

export const redisConnection = new IORedis(redisConfig);

redisConnection.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});

redisConnection.on('connect', () => {
  console.log(`Connected to Redis at ${redisConfig.host}:${redisConfig.port}`);
});
