import { RedisClientType } from "redis"
import { createRedisClient } from "./helpers"
import { runSnapshotJob } from "./snapshotJob"

async function runCronJob() {
    const redisClient: RedisClientType = await createRedisClient()

    try {
        await runSnapshotJob(redisClient);
        console.log('[snapshot] Job completed successfully');
    } catch (err) {
        console.error('[snapshot] Job failed with unhandled error:', err);
        await redisClient.set('snapshot:job:status', 'failed');
    } finally {
        await redisClient.quit();
        console.log('[snapshot] Redis connection closed');
    }
}

runCronJob()
    .then(() => {
        console.log('[snapshot] Script exiting');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[snapshot] Fatal error:', err);
        process.exit(1);
    });