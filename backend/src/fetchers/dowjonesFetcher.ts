import { DOWJONES } from '../index_compositions/dowjones';
import type { IndexFetcher, IndexConstituent, SP500Response } from '../lib/indexTypes';

/**
 * Fetcher for DOWJONES constituent stocks
 */
export class DOWJONESFetcher implements IndexFetcher {
    readonly indexType = 'DOWJONES' as const;

    async fetchConstituents(): Promise<IndexConstituent[]> {
        try {
            return DOWJONES.map(item => ({
                symbol: item.ticker.trim().toUpperCase(),
                name: item.company,
            }));

        } catch (error) {
            console.error('[DOWJONES] Failed to fetch constituents:', error);
            throw new Error(
                `Failed to fetch DOWJONES constituents: ${error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }
}