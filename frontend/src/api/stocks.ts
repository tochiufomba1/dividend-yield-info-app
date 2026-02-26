export interface StockData {
    ticker?: string;
    name: string;
    sector: string;
    yield: number;
}

export interface TickersResponse {
    success: boolean;
    data: string[];
    count: number;
}

export interface SearchResponse {
    success: boolean;
    data: string[];
    count: number;
    total: number;
}

export interface StockResponse {
    success: boolean;
    data: StockData;
}

export interface BatchStocksResponse {
    success: boolean;
    data: Record<string, StockData>;
    errors?: Record<string, string>;
    summary: {
        total: number;
        successful: number;
        failed: number;
    };
}

/**
 * Search for tickers by query string
 * This is what AsyncSelect will use!
 */
export async function searchTickers(query: string, limit: number = 50): Promise<string[]> {
    if (!query || query.length < 1) {
        return [];
    }

    const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
    });

    const url = `${import.meta.env.VITE_API_URL}/api/stocks/search?${params}`;

    const response = await fetch(url);

    const ret: SearchResponse = await response.json()

    return ret.data;
}

export async function getStock(ticker: string): Promise<StockData> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/stocks/${ticker}`);
    return await response.json()
}

export async function getTickers(): Promise<TickersResponse> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/stocks/tickers`);
    const ret: TickersResponse = await response.json()
    return ret
}

export async function getBatchStocks(tickers: string[]): Promise<BatchStocksResponse> {
    const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stocks/batch`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',  // ← Add this!
            },
            body: JSON.stringify({ tickers })
        }
    );

    return await response.json()
}