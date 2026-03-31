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

...(process.env.REDIS_HOST?.includes('.cache.amazonaws.com') && {
    tls: {
      rejectUnauthorized: true, // ElastiCache uses valid certificates
    },
    connectTimeout: 10000,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
  }),
  
  // Connection retry strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
};

export const redisConnection = new IORedis(redisConfig);

redisConnection.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});

redisConnection.on('connect', () => {
  console.log(`Connected to Redis at ${redisConfig.host}:${redisConfig.port}`);
});
