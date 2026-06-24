import { Redis } from '@upstash/redis';
import process from 'process';
process.loadEnvFile('.env');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
async function run() {
  const directory = await redis.hgetall('users:directory');
  console.log('Directory:', typeof directory, Array.isArray(directory) ? 'Array' : 'Object');
  console.log('Keys:', directory ? Object.keys(directory) : 'null');
}
run();
