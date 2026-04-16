import type { IndexFetcher, IndexConstituent, NASDAQ100Response } from '../lib/indexTypes';

const NASDAQ_API_URL = 'https://api.nasdaq.com/api/quote/list-type/nasdaq100';

/**
 * Fetcher for NASDAQ-100 constituent stocks
 */
export class NASDAQ100Fetcher implements IndexFetcher {
    readonly indexType = 'NASDAQ100' as const;

    async fetchConstituents(): Promise<IndexConstituent[]> {
        try {
            const response = await fetch(NASDAQ_API_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`NASDAQ API returned ${response.status}`);
            }

            const data = await response.json() as NASDAQ100Response;

            // Validate response
            if (data.status.rCode !== 200) {
                throw new Error(
                    data.status.developerMessage || 
                    'NASDAQ API returned error status'
                );
            }

            if (!data.data?.data.rows || !Array.isArray(data.data.data.rows)) {
                console.log(data)
                throw new Error('Invalid NASDAQ API response structure');
            }

            // Extract constituents
            return data.data.data.rows.map(row => ({
                symbol: row.symbol.trim().toUpperCase(),
                name: row.companyName,
                marketCap: row.marketCap,
            }));

        } catch (error) {
            console.error('[NASDAQ100] Failed to fetch constituents:', error);
            throw new Error(
                `Failed to fetch NASDAQ-100 constituents: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    /**
     * Optional: Check if a ticker is in NASDAQ-100
     */
    async isConstituent(ticker: string): Promise<boolean> {
        const constituents = await this.fetchConstituents();
        return constituents.some(c => c.symbol === ticker.toUpperCase());
    }
}