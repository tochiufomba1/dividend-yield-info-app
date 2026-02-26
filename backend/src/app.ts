import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createClient, type RedisClientType } from 'redis';
import { createStockRoutes, errorHandler } from './routes';
import { Server } from 'http';
import config from './config/config';
import cron from 'node-cron'
import { runSnapshotJob } from './snapshotJob';
import { createSnapshotRoutes } from './snapshotRoutes';

export interface AppComponents {
    app: Express;
    server: Server;
    redisClient: RedisClientType;
}

async function createApp(): Promise<AppComponents> {

    const app = express();
    const PORT = config.port;

    // Security middleware
    app.use(helmet());

    // CORS configuration
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
        credentials: true,
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging in development
    if (process.env.NODE_ENV !== 'production') {
        app.use((req, _, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    // ── Redis ──────────────────────────────────────────────────────────────────
    const redisClient: RedisClientType = createClient({
        url: config.redisUrl,
    });

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Connected to Redis');
    });

    redisClient.on('reconnecting', () => {
        console.log('Reconnecting to Redis...');
    });

    await redisClient.connect();

    // ── Routes ─────────────────────────────────────────────────────────────────
    app.get('/health', (_, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });

    app.use('/api/stocks', createStockRoutes(redisClient));

    app.use('/api/snapshot', createSnapshotRoutes(redisClient));

    // 404 handler
    app.use((_, res) => {
        res.status(404).json({
            error: 'NOT_FOUND',
            message: 'The requested endpoint does not exist',
        });
    });

    // Global error handler
    app.use(errorHandler);

    // ── Cron: rebuild snapshot every night at 2 AM ─────────────────────────────
    cron.schedule('0 2 * * *', () => {
        console.log('[cron] Triggering nightly snapshot job...');
        runSnapshotJob(redisClient).catch(err =>
            console.error('[cron] Snapshot job failed:', err)
        );
    });
    console.log('⏰ Nightly snapshot job scheduled for 02:00');

    // ── Server ─────────────────────────────────────────────────────────────────
    const shutdown = async () => {
        console.log('\nShutting down gracefully...');

        await redisClient.quit();
        console.log('Redis connection closed');

        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start server
    const server = app.listen(PORT, () => {
        console.log(`App listening on port ${config.port}`)
    });

    return { app, server, redisClient };
}

// Start the application
if (require.main === module) {
    createApp().catch((error) => {
        console.error('Failed to start application:', error);
        process.exit(1);
    });
}

export { createApp };