import { useQuery, useQueries } from '@tanstack/react-query';
import { getStock, getBatchStocks, type StockData } from '../api/stocks';

/**
 * Hook to fetch data for a single stock
 */
export function useStock(ticker: string, enabled: boolean = true) {
  return useQuery<StockData>({
    queryKey: ['stock', ticker],
    queryFn: () => getStock(ticker),
    enabled: enabled && !!ticker, // Only fetch if enabled and ticker exists
    staleTime: 60 * 60 * 1000, // 1 hour
    // cacheTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 2,
  });
}

/**
 * Hook to fetch data for multiple stocks individually
 * Uses parallel queries - good for small number of stocks
 */
export function useStocks(tickers: string[]) {
  return useQueries({
    queries: tickers.map((ticker) => ({
      queryKey: ['stock', ticker],
      queryFn: () => getStock(ticker),
      staleTime: 60 * 60 * 1000,
      cacheTime: 2 * 60 * 60 * 1000,
      retry: 2,
    })),
  });
}

/**
 * Hook to fetch multiple stocks using batch endpoint
 * More efficient for large number of stocks
 */
export function useBatchStocks(tickers: string[], enabled: boolean = true) {
  return useQuery({
    queryKey: ['stocks', 'batch', tickers.sort().join(',')],
    queryFn: () => getBatchStocks(tickers),
    enabled: enabled && tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    // cacheTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 2,
  });
}