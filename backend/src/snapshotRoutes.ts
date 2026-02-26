import express, { Request, Response, Router } from 'express';
import { RedisClientType } from 'redis';
import rateLimit from 'express-rate-limit';
import {
    runSnapshotJob,
    getJobStatus,
    getJobProgress,
    getSnapshot,
    cancelJob,
} from  './snapshotJob';

const triggerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,                    // Only allow triggering the job 3 times per hour
    message: { error: 'RATE_LIMIT', message: 'Snapshot job trigger limit reached.' },
});

export function createSnapshotRoutes(redisClient: RedisClientType): Router {
    const router = express.Router();

    /**
     * GET /api/snapshot
     * Returns the pre-built snapshot if it exists.
     */
    router.get('/', async (req: Request, res: Response) => {
        const snapshot = await getSnapshot(redisClient);

        if (!snapshot) {
            const status = await getJobStatus(redisClient);
            return res.status(404).json({
                error: 'NOT_READY',
                message: status === 'running'
                    ? 'Snapshot is still being built. Check /api/snapshot/progress.'
                    : 'No snapshot available. POST /api/snapshot/trigger to start building one.',
            });
        }

        return res.json({
            success: true,
            data: snapshot,
            count: snapshot.length,
        });
    });

    /**
     * GET /api/snapshot/status
     * Returns current job status and progress.
     */
    router.get('/status', async (req: Request, res: Response) => {
        const [status, progress, snapshot] = await Promise.all([
            getJobStatus(redisClient),
            getJobProgress(redisClient),
            getSnapshot(redisClient),
        ]);

        res.json({
            status,
            progress,
            snapshotReady: snapshot !== null,
            snapshotCount: snapshot?.length ?? 0,
        });
    });

    /**
     * GET /api/snapshot/progress (Server-Sent Events)
     *
     * Streams live progress to the client so a progress bar can be shown
     * while the job runs. The frontend connects once and receives updates
     * every 3 seconds without polling.
     *
     * Usage:
     *   const source = new EventSource('/api/snapshot/progress');
     *   source.onmessage = (e) => {
     *     const { status, progress } = JSON.parse(e.data);
     *   };
     */
    router.get('/progress', async (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const send = (data: object) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const interval = setInterval(async () => {
            const [status, progress] = await Promise.all([
                getJobStatus(redisClient),
                getJobProgress(redisClient),
            ]);

            send({ status, progress });

            // Close the stream once job is no longer running
            if (status !== 'running') {
                clearInterval(interval);
                res.end();
            }
        }, 3000); // Poll Redis every 3 seconds

        // Clean up if the client disconnects
        req.on('close', () => clearInterval(interval));
    });

    /**
     * POST /api/snapshot/trigger
     * Manually trigger the snapshot job (also called by the cron).
     * Runs the job asynchronously — returns immediately.
     */
    router.post('/trigger', triggerLimiter, async (req: Request, res: Response) => {
        const status = await getJobStatus(redisClient);

        if (status === 'running') {
            return res.status(409).json({
                error: 'CONFLICT',
                message: 'A snapshot job is already running.',
            });
        }

        // Fire and forget — the job runs in the background
        runSnapshotJob(redisClient).catch(err => {
            console.error('[snapshot] Job failed with unhandled error:', err);
            redisClient.set('snapshot:job:status', 'failed');
        });

        return res.json({
            success: true,
            message: 'Snapshot job started. Poll /api/snapshot/progress for updates.',
        });
    });

    /**
     * DELETE /api/snapshot/cancel
     * Signals the running job to stop after its current ticker.
     */
    router.delete('/cancel', async (req: Request, res: Response) => {
        const status = await getJobStatus(redisClient);

        if (status !== 'running') {
            return res.status(400).json({
                error: 'NOT_RUNNING',
                message: 'No job is currently running.',
            });
        }

        await cancelJob(redisClient);
        return res.json({ success: true, message: 'Cancel signal sent.' });
    });

    return router;
}