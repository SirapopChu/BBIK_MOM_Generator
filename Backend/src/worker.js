import './config/index.js'; // Load env
import { Worker } from 'bullmq';
import { redisConnection } from './config/redis.js';
import { runAudioPipeline } from './services/pipeline.service.js';
import { initDb } from './config/database.js';

/**
 * BullMQ Worker Entry Point
 * 
 * Listens to the 'audio-pipeline' queue and processes jobs.
 * This runs as a separate process from the Express server.
 */

// Initialize DB connection for the worker process
initDb().catch(console.error);

const worker = new Worker(
  'audio-pipeline',
  async (job) => {
    const { taskId, userId, file, language, metadata, model } = job.data;
    
    // De-serialize the buffer from Base64
    const fileData = {
      ...file,
      buffer: Buffer.from(file.buffer, 'base64'),
    };

    console.log(`[Worker] Starting job ${job.id} (Task ${taskId}) [User: ${userId}] [Model: ${model || 'default'}]`);
    await runAudioPipeline(taskId, userId, fileData, language, metadata, model);
    console.log(`[Worker] Job ${job.id} completed.`);
  },
  {
    connection: redisConnection,
    concurrency: 2, // Allow 2 simultaneous audio processings per worker
  }
);

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

console.log('Audio Pipeline Worker is running and listening for jobs...');
