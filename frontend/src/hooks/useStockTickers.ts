import { useQuery } from '@tanstack/react-query';
import {  getTickers, type TickersResponse } from '../api/stocks';

export function useStockTickers() {
  return useQuery<TickersResponse>({
    queryKey: ['tickers'],
    queryFn: async () => {
        const response = await getTickers()
        return response
       
    },
    staleTime: 60 * 60 * 24000, // 24 hours
  });
}