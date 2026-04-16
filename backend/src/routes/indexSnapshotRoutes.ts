import express, { Request, Response, Router } from 'express';
import { RedisClientType } from 'redis';
import rateLimit from 'express-rate-limit';
import {
    runIndexSnapshotJob,
    getIndexJobStatus,
    getIndexJobProgress,
    getIndexSnapshot,
    cancelIndexJob,
} from '../indexSnapshotJob';
import { NASDAQ100Fetcher } from '../fetchers/nasdaq100Fetcher';
import type { IndexType, IndexFetcher } from '../lib/indexTypes';
import { SP500Fetcher } from '../fetchers/sp500Fetcher';
import { DOWJONESFetcher } from '../fetchers/dowjonesFetcher';

const triggerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'RATE_LIMIT', message: 'Index snapshot trigger limit reached.' },
});

/**
 * Registry of available index fetchers
 * Add new indices here as they're implemented
 */
const INDEX_FETCHERS: Record<IndexType, () => IndexFetcher> = {
    NASDAQ100: () => new NASDAQ100Fetcher(),
    SP500: () => new SP500Fetcher(),
    DOWJONES: () => new DOWJONESFetcher(),
};

export function createIndexSnapshotRoutes(redisClient: RedisClientType): Router {
    const router = express.Router();

    /**
     * GET /api/index/:indexType
     * Get the pre-built snapshot for a specific index
     * 
     * Examples:
     *   GET /api/index/NASDAQ100
     *   GET /api/index/SP500
     */
    router.get('/:indexType', async (req: Request, res: Response) => {
        const indexType = (req.params.indexType as string).toUpperCase() as IndexType;

        // Validate index type
        if (!INDEX_FETCHERS[indexType]) {
            return res.status(400).json({
                error: 'INVALID_INDEX',
                message: `Unknown index type: ${indexType}`,
                availableIndices: Object.keys(INDEX_FETCHERS),
            });
        }

        const snapshot = await getIndexSnapshot(indexType, redisClient);

        if (!snapshot) {
            const status = await getIndexJobStatus(indexType, redisClient);
            return res.status(404).json({
                error: 'NOT_READY',
                message: status === 'running'
                    ? `${indexType} snapshot is still being built. Check /api/index/${indexType}/progress.`
                    : `No ${indexType} snapshot available. POST /api/index/${indexType}/trigger to build one.`,
            });
        }

        return res.json({
            success: true,
            indexType: snapshot.indexType,
            data: snapshot.constituents,
            metadata: snapshot.metadata,
        });
    });

    /**
     * GET /api/index/:indexType/status
     * Get current job status and progress for a specific index
     */
    router.get('/:indexType/status', async (req: Request, res: Response) => {
        const indexType = (req.params.indexType as string).toUpperCase() as IndexType;

        if (!INDEX_FETCHERS[indexType]) {
            return res.status(400).json({
                error: 'INVALID_INDEX',
                message: `Unknown index type: ${indexType}`,
            });
        }

        const [status, progress, snapshot] = await Promise.all([
            getIndexJobStatus(indexType, redisClient),
            getIndexJobProgress(indexType, redisClient),
            getIndexSnapshot(indexType, redisClient),
        ]);

        return res.json({
            indexType,
            status,
            progress,
            snapshotReady: snapshot !== null,
            snapshotCount: snapshot?.constituents.length ?? 0,
            metadata: snapshot?.metadata,
        });
    });

    /**
     * GET /api/index/:indexType/progress (Server-Sent Events)
     * Stream live progress updates
     */
    router.get('/:indexType/progress', async (req: Request, res: Response) => {
        const indexType = (req.params.indexType as string).toUpperCase() as IndexType;

        if (!INDEX_FETCHERS[indexType]) {
            return res.status(400).json({
                error: 'INVALID_INDEX',
                message: `Unknown index type: ${indexType}`,
            });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const send = (data: object) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const interval = setInterval(async () => {
            const [status, progress] = await Promise.all([
                getIndexJobStatus(indexType, redisClient),
                getIndexJobProgress(indexType, redisClient),
            ]);

            send({ indexType, status, progress });

            if (status !== 'running') {
                clearInterval(interval);
                res.end();
            }
        }, 3000);

        req.on('close', () => clearInterval(interval));

        return
    });

    /**
     * POST /api/index/:indexType/trigger
     * Trigger snapshot job for a specific index
     */
    router.post('/:indexType/trigger', triggerLimiter, async (req: Request, res: Response) => {
        const indexType = (req.params.indexType as string).toUpperCase() as IndexType;

        if (!INDEX_FETCHERS[indexType]) {
            return res.status(400).json({
                error: 'INVALID_INDEX',
                message: `Unknown index type: ${indexType}`,
                availableIndices: Object.keys(INDEX_FETCHERS),
            });
        }

        const status = await getIndexJobStatus(indexType, redisClient);

        if (status === 'running') {
            return res.status(409).json({
                error: 'CONFLICT',
                message: `A ${indexType} snapshot job is already running.`,
            });
        }

        try {
            // Get the appropriate fetcher
            const fetcher = INDEX_FETCHERS[indexType]();

            // Run job in background
            runIndexSnapshotJob(fetcher, redisClient).catch(err => {
                console.error(`[${indexType}] Job failed:`, err);
                redisClient.set(`snapshot:${indexType.toLowerCase()}:status`, 'failed');
            });

            res.json({
                success: true,
                message: `${indexType} snapshot job started. Poll /api/index/${indexType}/progress for updates.`,
            });
        } catch (error) {
            res.status(500).json({
                error: 'TRIGGER_FAILED',
                message: error instanceof Error ? error.message : 'Failed to start job',
            });
        }

        return
    });

    /**
     * DELETE /api/index/:indexType/cancel
     * Cancel a running job
     */
    router.delete('/:indexType/cancel', async (req: Request, res: Response) => {
        const indexType = (req.params.indexType as string).toUpperCase() as IndexType;

        if (!INDEX_FETCHERS[indexType]) {
            return res.status(400).json({
                error: 'INVALID_INDEX',
                message: `Unknown index type: ${indexType}`,
            });
        }

        const status = await getIndexJobStatus(indexType, redisClient);

        if (status !== 'running') {
            return res.status(400).json({
                error: 'NOT_RUNNING',
                message: `No ${indexType} job is currently running.`,
            });
        }

        await cancelIndexJob(indexType, redisClient);
        res.json({ 
            success: true, 
            message: `${indexType} job cancel signal sent.` 
        });

        return
    });

    /**
     * GET /api/index/available
     * List all available indices
     */
    router.get('/', async (req: Request, res: Response) => {
        const indices = await Promise.all(
            Object.keys(INDEX_FETCHERS).map(async (indexType) => {
                const snapshot = await getIndexSnapshot(indexType as IndexType, redisClient);
                const status = await getIndexJobStatus(indexType as IndexType, redisClient);

                return {
                    indexType,
                    available: snapshot !== null,
                    status,
                    count: snapshot?.constituents.length ?? 0,
                    metadata: snapshot?.metadata,
                };
            })
        );

        res.json({
            success: true,
            indices,
        });
    });

    return router;
}