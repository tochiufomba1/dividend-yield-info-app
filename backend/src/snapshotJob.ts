import { RedisClientType } from 'redis';
import { fetchStockFundamentals } from './dataFetcher';
import type { StockData } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

// Alpha Vantage free tier: 25/day. Premium tiers go up to 75/min.
// Set conservatively so the job never trips the rate limiter.
const REQUESTS_PER_MINUTE = parseInt(process.env.AV_REQUESTS_PER_MINUTE ?? '60', 10);
const MS_PER_REQUEST = Math.ceil((60 / REQUESTS_PER_MINUTE) * 1000); // e.g. 800ms at 75/min

// Redis keys
const SNAPSHOT_KEY     = 'snapshot:all';           // The finished dataset
const JOB_STATUS_KEY   = 'snapshot:job:status';    // 'idle' | 'running' | 'failed'
const JOB_PROGRESS_KEY = 'snapshot:job:progress';  // { completed, total, startedAt }

// Cache the finished snapshot for 24 hours; job runs once a day via cron
const SNAPSHOT_EXPIRY = 24 * 60 * 60;             // 24 hours in seconds

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'idle' | 'running' | 'failed';

export interface JobProgress {
    completed: number;
    total: number;
    startedAt: string;        // ISO timestamp
    estimatedMinutes: number; // How many minutes left
}

export interface SnapshotEntry extends StockData {
    ticker: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function getAllTickers(redisClient: RedisClientType): Promise<string[]> {
    const raw = await redisClient.get('tickers');
    if (!raw) throw new Error('Tickers not in cache. Run fetcher("tickers", ...) first.');
    return JSON.parse(raw) as string[];
}

// ─── Job ──────────────────────────────────────────────────────────────────────

/**
 * Builds a full snapshot of dividend data for every cached ticker.
 *
 * Designed to run as a background job (cron or worker thread) — NOT in a
 * request handler. Progress is written to Redis so the API can stream it
 * to the client via SSE (see routes).
 */
export async function runSnapshotJob(redisClient: RedisClientType): Promise<void> {
    // ── Guard: don't run two jobs simultaneously ──────────────────────────────
    const currentStatus = await redisClient.get(JOB_STATUS_KEY);
    if (currentStatus === 'running') {
        console.log('[snapshot] Job already running — skipping duplicate trigger.');
        return;
    }

    const tickers = await getAllTickers(redisClient);
    const total    = tickers.length;
    let   completed = 0;
    let   failed    = 0;

    // Accumulate results here; write to Redis in one shot at the end
    const snapshot: SnapshotEntry[] = [];

    await redisClient.set(JOB_STATUS_KEY, 'running' satisfies JobStatus);
    await redisClient.set(JOB_PROGRESS_KEY, JSON.stringify({
        completed: 0,
        total,
        startedAt: new Date().toISOString(),
        estimatedMinutes: Math.ceil(total / REQUESTS_PER_MINUTE),
    } satisfies JobProgress));

    console.log(
        `[snapshot] Starting — ${total} tickers @ ${REQUESTS_PER_MINUTE} req/min ` +
        `(~${Math.ceil(total / REQUESTS_PER_MINUTE)} min)`
    );

    for (const ticker of tickers) {
        // ── Check for cancellation signal each iteration ───────────────────
        const status = await redisClient.get(JOB_STATUS_KEY);
        if (status !== 'running') {
            console.log('[snapshot] Cancelled externally.');
            return;
        }

        try {
            // Individual stock results may already be cached by the regular
            // fetcher — fetchStockFundamentals checks its own cache.
            const data = await fetchStockFundamentals(ticker);

            // Only include stocks that actually pay a dividend
            if (data.yield > 0) {
                snapshot.push({ ...data });
            }

            completed++;
        } catch (err) {
            // Non-fatal: log and move on so one bad ticker doesn't abort the run
            console.warn(`[snapshot] Failed to fetch ${ticker}:`, (err as Error).message);
            failed++;
        }

        // Update progress counter in Redis (cheap write every N tickers)
        if (completed % 50 === 0 || completed === total) {
            const remaining  = total - completed - failed;
            const estimatedMinutes = Math.ceil(remaining / REQUESTS_PER_MINUTE);

            await redisClient.set(JOB_PROGRESS_KEY, JSON.stringify({
                completed,
                total,
                startedAt: (JSON.parse(
                    (await redisClient.get(JOB_PROGRESS_KEY)) ?? '{}'
                ) as JobProgress).startedAt,
                estimatedMinutes,
            } satisfies JobProgress));
        }

        // ── Rate-limit throttle ────────────────────────────────────────────
        await sleep(MS_PER_REQUEST);
    }

    // ── Persist finished snapshot ──────────────────────────────────────────
    await redisClient.set(SNAPSHOT_KEY, JSON.stringify(snapshot), {
        EX: SNAPSHOT_EXPIRY,
    });
    await redisClient.set(JOB_STATUS_KEY, 'idle' satisfies JobStatus);

    console.log(
        `[snapshot] Done — ${snapshot.length} paying-dividend stocks stored, ` +
        `${failed} tickers skipped.`
    );
}

// ─── Public helpers for routes ────────────────────────────────────────────────

export async function getJobStatus(
    redisClient: RedisClientType
): Promise<JobStatus> {
    return ((await redisClient.get(JOB_STATUS_KEY)) ?? 'idle') as JobStatus;
}

export async function getJobProgress(
    redisClient: RedisClientType
): Promise<JobProgress | null> {
    const raw = await redisClient.get(JOB_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as JobProgress) : null;
}

export async function getSnapshot(
    redisClient: RedisClientType
): Promise<SnapshotEntry[] | null> {
    const raw = await redisClient.get(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as SnapshotEntry[]) : null;
}

export async function cancelJob(redisClient: RedisClientType): Promise<void> {
    await redisClient.set(JOB_STATUS_KEY, 'idle' satisfies JobStatus);
}