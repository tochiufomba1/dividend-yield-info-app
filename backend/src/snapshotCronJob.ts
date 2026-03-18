import { RedisClientType } from "redis"
import { createRedisClient } from "./helpers"
import { runSnapshotJob } from "./snapshotJob"

async function runCronJob() {
    const redisClient: RedisClientType = await createRedisClient()
    
    runSnapshotJob(redisClient).catch(err => {
        console.error('[snapshot] Job failed with unhandled error:', err);
        redisClient.set('snapshot:job:status', 'failed');
    });
}

runCronJob()