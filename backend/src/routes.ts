import express, { type Request, type Response, type NextFunction, Router } from 'express';
import { type RedisClientType } from 'redis';
import rateLimit from 'express-rate-limit';
import { fetcher, fetchBatch } from './dataFetcher';

interface TickerParams {
    ticker: string;
}

const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Higher limit for search
    message: {
        error: 'RATE_LIMIT',
        message: 'Too many search requests, please slow down.',
    },
});

type GetTickerRequest = Request<TickerParams>;

// Rate limiting middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'RATE_LIMIT',
        message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const stockLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 stock requests per minute
    message: {
        error: 'RATE_LIMIT',
        message: 'Too many stock requests, please slow down.',
    },
});

/**
 * Create stock routes
 */
export function createStockRoutes(redisClient: RedisClientType): Router {
    const router = express.Router();

    // Apply rate limiting to all routes
    router.use(apiLimiter);

    /**
     * GET /api/stocks/tickers
     * Fetch list of all available tickers
     */
    router.get('/tickers', async (req: Request, res: Response) => {
        try {
            const tickersJSON = await fetcher('tickers', redisClient);
            const tickers = JSON.parse(tickersJSON);

            if (tickers.error) {
                return res.status(503).json(tickers);
            }

            res.json({
                success: true,
                data: tickers,
                count: tickers.length,
            });
            return
        } catch (error) {
            console.error('Error fetching tickers:', error);
            res.status(500).json({
                error: 'INTERNAL_ERROR',
                message: 'Failed to fetch tickers',
            });
            return
        }
    });

    // GET /api/stocks/search?q=AAP&limit=50
    // Add to your existing routes.ts
    router.get('/search', searchLimiter, async (req: Request, res: Response) => {
        try {
            const { q, limit = '50' } = req.query;
            console.log(`W: ${q}     || limit: ${limit}`)

            if (!q || typeof q !== 'string') {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: 'Query parameter "q" is required',
                });
            }

            const tickersJSON = await fetcher('tickers', redisClient);
            const allTickers = JSON.parse(tickersJSON);

            const searchQuery = q.toUpperCase().trim();
            const maxResults = Math.min(parseInt(limit as string, 10), 100);

            const matchingTickers = allTickers
                .filter((ticker: string) => ticker.startsWith(searchQuery))
                .slice(0, maxResults);

            return res.json({
                success: true,
                data: matchingTickers,
                count: matchingTickers.length,
            });
        } catch (error) {
            console.error('Error searching tickers:', error);
            return res.status(500).json({
                error: 'INTERNAL_ERROR',
                message: 'Failed to search tickers',
            });
        }
    });

    /**
     * GET /api/stocks/:ticker
     * Fetch fundamentals for a specific stock
     */
    router.get(
        '/:ticker',
        stockLimiter,
        async (req: Request, res: Response) => {
            try {
                const { ticker } = req.params;

                // Validate ticker format
                // if (!/^[A-Z]{1,5}$/.test(ticker!.toUpperCase())) {
                //     return res.status(400).json({
                //         error: 'VALIDATION_ERROR',
                //         message: 'Invalid ticker format. Use 1-5 uppercase letters.',
                //     });
                // }

                const dataJSON = await fetcher(<string>ticker, redisClient);
                const data = JSON.parse(dataJSON);

                // Handle errors from fetcher
                if (data.error) {
                    const statusCode =
                        data.error === 'RATE_LIMIT' ? 429 :
                            data.error === 'VALIDATION_ERROR' ? 404 :
                                data.error === 'NETWORK_ERROR' ? 503 :
                                    500;

                    return res.status(statusCode).json(data);
                }

                res.json({
                    success: true,
                    data,
                });
                return
            } catch (error) {
                console.error('Error fetching stock data:', error);
                res.status(500).json({
                    error: 'INTERNAL_ERROR',
                    message: 'Failed to fetch stock data',
                });
                return
            }
        }
    );

    /**
     * POST /api/stocks/batch
     * Fetch multiple stocks at once
     * Body: { tickers: string[] }
     */
    router.post(
        '/batch',
        stockLimiter,
        async (req: Request, res: Response) => {
            try {
                const { tickers } = req.body;

                // Validate input
                if (!Array.isArray(tickers)) {
                    return res.status(400).json({
                        error: 'VALIDATION_ERROR',
                        message: 'tickers must be an array',
                    });
                }

                if (tickers.length === 0) {
                    return res.status(400).json({
                        error: 'VALIDATION_ERROR',
                        message: 'tickers array cannot be empty',
                    });
                }

                if (tickers.length > 50) {
                    return res.status(400).json({
                        error: 'VALIDATION_ERROR',
                        message: 'Maximum 50 tickers per batch request',
                    });
                }

                // Validate ticker formats
                const invalidTickers = tickers.filter(
                    t => typeof t !== 'string' || !/^[A-Z]{1,5}$/.test(t.toUpperCase())
                );

                if (invalidTickers.length > 0) {
                    return res.status(400).json({
                        error: 'VALIDATION_ERROR',
                        message: `Invalid ticker format: ${invalidTickers.join(', ')}`,
                    });
                }

                const results = await fetchBatch(
                    tickers.map(t => t.toUpperCase()),
                    redisClient,
                    5 // Concurrency
                );

                // Transform Map to object
                const data: any = {};
                const errors: any = {};

                results.forEach((value, ticker) => {
                    if (value instanceof Error) {
                        errors[ticker] = value.message;
                    } else {
                        data[ticker] = value;
                    }
                });

                res.json({
                    success: true,
                    data,
                    errors: Object.keys(errors).length > 0 ? errors : undefined,
                    summary: {
                        total: tickers.length,
                        successful: Object.keys(data).length,
                        failed: Object.keys(errors).length,
                    },
                });
                return
            } catch (error) {
                console.error('Error in batch request:', error);
                res.status(500).json({
                    error: 'INTERNAL_ERROR',
                    message: 'Failed to process batch request',
                });
                return
            }
        }
    );

    /**
     * GET /api/stocks/health
     * Health check endpoint
     */
    router.get('/health', async (req: Request, res: Response) => {
        try {
            // Check Redis connection
            await redisClient.ping();

            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                redis: 'connected',
            });
        } catch (error) {
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                redis: 'disconnected',
            });
        }
    });

    return router;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error('Unhandled error:', err);

    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
    });
}