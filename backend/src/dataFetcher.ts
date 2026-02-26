import { type RedisClientType } from 'redis';
import config from './config/config';
import { NetworkError, RateLimitError, ValidationError, SECTickerResponse, StockData, AlphaVantageResponse } from './types';

// Configuration constants
const TICKER_EXPIRY_TIME = 1209600; // 2 weeks in seconds
const STOCK_DATA_EXPIRY_TIME = 3600; // 1 hour in seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
    const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, attempt),
        MAX_RETRY_DELAY
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new NetworkError('Request timeout');
        }
        throw error;
    }
}

/**
 * Fetch with retry logic and exponential backoff
 */
async function fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    parseResponse: (res: Response) => Promise<T>,
    maxRetries: number = MAX_RETRIES
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options);

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter
                    ? parseInt(retryAfter) * 1000
                    : getRetryDelay(attempt);

                if (attempt < maxRetries) {
                    console.warn(`Rate limited, retrying after ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }
                throw new RateLimitError('API rate limit exceeded');
            }

            // Handle server errors (5xx) with retry
            if (response.status >= 500 && response.status < 600) {
                if (attempt < maxRetries) {
                    const delay = getRetryDelay(attempt);
                    console.warn(`Server error ${response.status}, retrying after ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }
                throw new NetworkError(`Server error: ${response.status}`);
            }

            // Handle client errors (4xx) without retry
            if (response.status >= 400 && response.status < 500) {
                throw new ValidationError(`Client error: ${response.status} - ${response.statusText}`);
            }

            // Success - parse and return
            if (response.ok) {
                return await parseResponse(response);
            }

            throw new NetworkError(`Unexpected status: ${response.status}`);

        } catch (error) {
            lastError = error as Error;

            // Don't retry on validation errors or non-network errors
            if (error instanceof ValidationError ||
                error instanceof RateLimitError ||
                (error instanceof Error && error.name !== 'NetworkError' && error.message !== 'Request timeout')) {
                throw error;
            }

            // Retry on network errors
            if (attempt < maxRetries) {
                const delay = getRetryDelay(attempt);
                console.warn(`Network error on attempt ${attempt + 1}/${maxRetries + 1}: ${error}. Retrying after ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw lastError || new NetworkError('Max retries exceeded');
}

/**
 * Fetch tickers from SEC
 */
async function fetchTickers(): Promise<string[]> {
    const response = await fetchWithRetry<SECTickerResponse>(
        'https://www.sec.gov/files/company_tickers.json',
        {
            headers: {
                'User-Agent': 'Sample Company Name AdminContact@gmail.com',
                'Accept': 'application/json',
            },
        },
        async (res) => res.json() as Promise<SECTickerResponse>
    );

    // Extract tickers correctly
    const tickers = Object.values(response).map(item => item.ticker);
    return tickers;
}

/**
 * Fetch stock fundamentals from Alpha Vantage
 */
export async function fetchStockFundamentals(ticker: string): Promise<StockData> {
    if (!config.alphaVantageAPIKey) {
        throw new Error('ALPHA_VANTAGE_API_KEY environment variable not set');
    }

    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

    const response = await fetchWithRetry<AlphaVantageResponse>(
        url,
        {
            headers: {
                'Accept': 'application/json',
            },
        },
        async (res) => res.json() as Promise<AlphaVantageResponse>
    );

    // Handle Alpha Vantage specific errors
    if (response['Error Message']) {
        throw new ValidationError(`Invalid ticker symbol: ${ticker}`);
    }

    if (response.Note) {
        // API rate limit message
        throw new RateLimitError('Alpha Vantage API rate limit reached');
    }

    // Validate required fields
    if (!response.Symbol) {
        throw new ValidationError(`No data found for ticker: ${ticker}`);
    }

    // Parse dividend yield
    let dividendYield = 0;
    if (response.DividendYield && response.DividendYield !== 'None' && response.DividendYield !== '-') {
        const parsed = parseFloat(response.DividendYield);
        if (!isNaN(parsed)) {
            // Alpha Vantage returns decimal (0.05 for 5%), convert to percentage
            dividendYield = parsed * 100;
        }
    }

    return {
        ticker: response.Symbol,
        name: response.Symbol, 
        sector: response.Sector ? getSectorTranslation(response.Sector) : 'Unknown',
        yield: dividendYield,
    };
}

/**
 * Main fetcher function with Redis caching
 */
export async function fetcher(
    key: string,
    redisClient: RedisClientType
): Promise<string> {
    try {
        // Validate input
        if (!key || typeof key !== 'string') {
            throw new ValidationError('Invalid key provided');
        }

        // Check cache first
        const cachedValue = await redisClient.get(key);
        if (cachedValue) {
            console.log(`Cache hit for key: ${key}`);
            return cachedValue;
        }

        console.log(`Cache miss for key: ${key}`);

        // Fetch tickers
        if (key === 'tickers') {
            const tickers = await fetchTickers();
            const tickersJSON = JSON.stringify(tickers);

            await redisClient.set('tickers', tickersJSON, {
                EX: TICKER_EXPIRY_TIME,
            });

            return tickersJSON;
        }

        // Fetch stock data
        const stockData = await fetchStockFundamentals(key);
        const stockDataJSON = JSON.stringify(stockData);

        // Cache the result
        await redisClient.set(key, stockDataJSON, {
            EX: STOCK_DATA_EXPIRY_TIME,
        });

        return stockDataJSON;

    } catch (error) {
        console.error(`Error fetching data for key "${key}":`, error);

        // Return structured error responses
        if (error instanceof RateLimitError) {
            return JSON.stringify({
                error: 'RATE_LIMIT',
                message: 'API rate limit exceeded. Please try again later.',
            });
        }

        if (error instanceof ValidationError) {
            return JSON.stringify({
                error: 'VALIDATION_ERROR',
                message: error.message,
            });
        }

        if (error instanceof NetworkError) {
            return JSON.stringify({
                error: 'NETWORK_ERROR',
                message: 'Network error occurred. Please try again.',
            });
        }

        // Generic error
        return JSON.stringify({
            error: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred.',
        });
    }
}

/**
 * Batch fetcher for multiple tickers
 */
export async function fetchBatch(
    tickers: string[],
    redisClient: RedisClientType,
    concurrency: number = 5
): Promise<Map<string, StockData | Error>> {
    const results = new Map<string, StockData | Error>();

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < tickers.length; i += concurrency) {
        const batch = tickers.slice(i, i + concurrency);

        const promises = batch.map(async (ticker) => {
            try {
                const data = await fetcher(ticker, redisClient);
                const parsed = JSON.parse(data);

                if (parsed.error) {
                    results.set(ticker, new Error(parsed.message));
                } else {
                    results.set(ticker, parsed as StockData);
                }
            } catch (error) {
                results.set(ticker, error as Error);
            }
        });

        await Promise.all(promises);

        // Rate limiting: wait between batches
        if (i + concurrency < tickers.length) {
            await sleep(1000); // 1 second between batches
        }
    }

    return results;
}

export function getSectorTranslation(sector: string) {
    let sectorTranslation;

    switch (sector.toLowerCase()) {
        case "technology":
        case "industrials":
        case "basic materials":
            sectorTranslation = "Manufacturing";
            break;
        case "healthcare":
        case "financial services":
        case "communication services":
            sectorTranslation = "Services"
            break;
        case "basic materials":
            sectorTranslation = "Agriculture"
            break;
        case "consumer cyclical":
        case "consumer defensive":
            sectorTranslation = "Retail"
            break;
        case "real estate":
            sectorTranslation = "Property"
            break;
        case "utilities":
        case "energy":
            sectorTranslation = "Energy"
            break;
        default:
            sectorTranslation = "Unknown"
            break;
    }

    return sectorTranslation
}