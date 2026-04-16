import type { IndexFetcher, IndexConstituent, SP500Response } from '../lib/indexTypes';

const SP500_API_URL = 'https://gist.githubusercontent.com/princefishthrower/30ab8a532b4b281ce5bfe386e1df7a29/raw/5bfd40048667f406bb5c704efe58cd087ae9a81f/sandp500.json';

/**
 * Fetcher for S&P 500 constituent stocks
 */
export class SP500Fetcher implements IndexFetcher {
    readonly indexType = 'SP500' as const;

    async fetchConstituents(): Promise<IndexConstituent[]> {
        try {
            const response = await fetch(SP500_API_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`S&P 500 API returned ${response.status}`);
            }

            const data = await response.json() as SP500Response;

            // Parse based on actual API structure
            return data.companies.map(item => ({
                symbol: item.symbol.trim().toUpperCase(),
                name: item.name,
            }));

        } catch (error) {
            console.error('[SP500] Failed to fetch constituents:', error);
            throw new Error(
                `Failed to fetch S&P 500 constituents: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }
}