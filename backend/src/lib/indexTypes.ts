import type { StockData } from './types';

// ─── Index Types ──────────────────────────────────────────────────────────────

export type IndexType = 'NASDAQ100' | 'SP500' | 'DOWJONES';

export interface IndexConstituent {
    symbol: string;
    name?: string;
    marketCap?: string;
}

// ─── NASDAQ-100 API Response ──────────────────────────────────────────────────

export interface NASDAQ100Response {
    data: {
        totalrecords: number;
        limit: number;
        offset: number;
        date: Date;
        data: {
            asOf?: string | null;
            headers: {
                symbol: string;
                companyName: string;
                marketCap: string;
                lastSalePrice: string;
                netChange: string;
                percentageChange: string;
            }

            rows: Array<{
                symbol: string;
                companyName?: string;
                marketCap?: string;
            }>;

            filter?: string | null;
            title?: string | null;
        }
    };
    message?: string | null;
    status: {
        rCode: number;
        bCodeMessage?: string | null;
        developerMessage?: string | null;
    }
}

// ─── S&P 500 API Response (example structure) ────────────────────────────────

export interface SP500Response {
    companies: Array<{
        symbol: string;
        name: string;
    }>
}

// ─── Generic Index Fetcher Interface ──────────────────────────────────────────

/**
 * Interface that all index fetchers must implement
 * Allows adding new indices without changing core snapshot logic
 */
export interface IndexFetcher {
    /**
     * Unique identifier for this index
     */
    readonly indexType: IndexType;

    /**
     * Fetch the list of constituent tickers
     * @returns Array of ticker symbols
     */
    fetchConstituents(): Promise<IndexConstituent[]>;

    /**
     * Optional: Validate a ticker belongs to this index
     */
    isConstituent?(ticker: string): Promise<boolean>;
}

// ─── Index Snapshot Data ──────────────────────────────────────────────────────

export interface IndexSnapshot {
    indexType: IndexType;
    constituents: Array<StockData & { ticker: string }>;
    metadata: {
        totalStocks: number;
        successfulFetches: number;
        failedFetches: number;
        averageYield: number;
        fetchedAt: string;
    };
}

// ─── Job Progress for Index Snapshots ─────────────────────────────────────────

export interface IndexSnapshotProgress {
    indexType: IndexType;
    completed: number;
    total: number;
    startedAt: string;
    estimatedMinutes: number;
}