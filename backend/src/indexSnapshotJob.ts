import { RedisClientType } from 'redis';
import { fetchStockFundamentals } from './fetchers/dataFetcher';
import type { StockData } from './lib/types';
import type { 
    IndexFetcher, 
    IndexSnapshot, 
    IndexSnapshotProgress,
    IndexType 
} from './lib/indexTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUESTS_PER_MINUTE = parseInt(process.env.AV_REQUESTS_PER_MINUTE ?? '60', 10);
const MS_PER_REQUEST = Math.ceil((60 / REQUESTS_PER_MINUTE) * 1000);

// Redis keys are prefixed by index type
const getSnapshotKey = (indexType: IndexType) => `snapshot:${indexType.toLowerCase()}`;
const getStatusKey = (indexType: IndexType) => `snapshot:${indexType.toLowerCase()}:status`;
const getProgressKey = (indexType: IndexType) => `snapshot:${indexType.toLowerCase()}:progress`;

const SNAPSHOT_EXPIRY = 24 * 60 * 60; // 24 hours

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'idle' | 'running' | 'failed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Main Job Function ────────────────────────────────────────────────────────

/**
 * Generic function to build an index snapshot
 * Works with any IndexFetcher implementation (NASDAQ-100, S&P 500, etc.)
 * 
 * @param fetcher - Implementation of IndexFetcher for the specific index
 * @param redisClient - Redis connection
 */
export async function runIndexSnapshotJob(
    fetcher: IndexFetcher,
    redisClient: RedisClientType
): Promise<void> {
    const { indexType } = fetcher;
    const statusKey = getStatusKey(indexType);
    const progressKey = getProgressKey(indexType);
    const snapshotKey = getSnapshotKey(indexType);

    // ── Guard: don't run two jobs simultaneously ──────────────────────────────
    const currentStatus = await redisClient.get(statusKey);
    if (currentStatus === 'running') {
        console.log(`[${indexType}] Job already running — skipping duplicate trigger.`);
        return;
    }

    console.log(`[${indexType}] Starting snapshot job...`);

    // ── Fetch index constituents ──────────────────────────────────────────────
    let constituents;
    try {
        constituents = await fetcher.fetchConstituents();
        console.log(`[${indexType}] Found ${constituents.length} constituent stocks`);
    } catch (error) {
        console.error(`[${indexType}] Failed to fetch constituents:`, error);
        await redisClient.set(statusKey, 'failed' satisfies JobStatus);
        throw error;
    }

    const tickers = constituents.map(c => c.symbol);
    const total = tickers.length;
    let completed = 0;
    let failed = 0;

    // Accumulate results
    const snapshot: Array<StockData> = [];

    await redisClient.set(statusKey, 'running' satisfies JobStatus);
    await redisClient.set(progressKey, JSON.stringify({
        indexType,
        completed: 0,
        total,
        startedAt: new Date().toISOString(),
        estimatedMinutes: Math.ceil(total / REQUESTS_PER_MINUTE),
    } satisfies IndexSnapshotProgress));

    console.log(
        `[${indexType}] Processing ${total} stocks @ ${REQUESTS_PER_MINUTE} req/min ` +
        `(~${Math.ceil(total / REQUESTS_PER_MINUTE)} min)`
    );

    // ── Fetch data for each stock ─────────────────────────────────────────────
    for (const ticker of tickers) {
        // Check for cancellation
        const status = await redisClient.get(statusKey);
        if (status !== 'running') {
            console.log(`[${indexType}] Cancelled externally.`);
            return;
        }

        try {
            const data = await fetchStockFundamentals(ticker); // modify with caching

            // Include all stocks (even if yield is 0)
            // You can filter by yield > 0 if desired
            snapshot.push({ ...data });

            completed++;
        } catch (err) {
            console.warn(`[${indexType}] Failed to fetch ${ticker}:`, (err as Error).message);
            failed++;
        }

        // Update progress every 10 stocks
        if (completed % 10 === 0 || completed === total) {
            const remaining = total - completed - failed;
            const estimatedMinutes = Math.ceil(remaining / REQUESTS_PER_MINUTE);

            await redisClient.set(progressKey, JSON.stringify({
                indexType,
                completed,
                total,
                startedAt: (JSON.parse(
                    (await redisClient.get(progressKey)) ?? '{}'
                ) as IndexSnapshotProgress).startedAt,
                estimatedMinutes,
            } satisfies IndexSnapshotProgress));
        }

        // Rate-limit throttle
        await sleep(MS_PER_REQUEST);
    }

    // ── Calculate metadata ────────────────────────────────────────────────────
    const totalYield = snapshot.reduce((sum, stock) => sum + stock.yield, 0);
    const averageYield = snapshot.length > 0 ? totalYield / snapshot.length : 0;

    const indexSnapshot: IndexSnapshot = {
        indexType,
        constituents: snapshot,
        metadata: {
            totalStocks: snapshot.length,
            successfulFetches: completed,
            failedFetches: failed,
            averageYield,
            fetchedAt: new Date().toISOString(),
        },
    };

    // ── Persist snapshot ──────────────────────────────────────────────────────
    await redisClient.set(snapshotKey, JSON.stringify(indexSnapshot), {
        EX: SNAPSHOT_EXPIRY,
    });
    await redisClient.set(statusKey, 'idle' satisfies JobStatus);

    console.log(
        `[${indexType}] ✅ Done — ${snapshot.length} stocks stored, ` +
        `${failed} failed, avg yield: ${averageYield.toFixed(2)}%`
    );
}

// ─── Public API for routes ────────────────────────────────────────────────────

export async function getIndexJobStatus(
    indexType: IndexType,
    redisClient: RedisClientType
): Promise<JobStatus> {
    return ((await redisClient.get(getStatusKey(indexType))) ?? 'idle') as JobStatus;
}

export async function getIndexJobProgress(
    indexType: IndexType,
    redisClient: RedisClientType
): Promise<IndexSnapshotProgress | null> {
    const raw = await redisClient.get(getProgressKey(indexType));
    return raw ? (JSON.parse(raw) as IndexSnapshotProgress) : null;
}

export async function getIndexSnapshot(
    indexType: IndexType,
    redisClient: RedisClientType
): Promise<IndexSnapshot | null> {
    const raw = await redisClient.get(getSnapshotKey(indexType));
    return raw ? (JSON.parse(raw) as IndexSnapshot) : null;
}

export async function cancelIndexJob(
    indexType: IndexType,
    redisClient: RedisClientType
): Promise<void> {
    await redisClient.set(getStatusKey(indexType), 'idle' satisfies JobStatus);
}