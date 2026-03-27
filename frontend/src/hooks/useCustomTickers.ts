import type { StockData } from "@/api/stocks";
import { useState } from "react";

export type CustomTickerData = StockData

export function useCustomTickers() {
    const [data, setData] = useState<CustomTickerData[]>([])

    /**
     * Add a new custom ticker
     * Prevents duplicates based on ticker symbol
     */
    function addCustomTicker(item: CustomTickerData) {
        setData((prev) => {
            // Check for duplicate
            if (prev.some(t => t.ticker === item.ticker)) {
                console.warn(`Ticker ${item.ticker} already exists`);
                return prev;
            }

            return [...prev, item]
        })
    }

     /**
     * Remove a custom ticker by matching ticker symbol
     */
    function removeCustomTicker(item: CustomTickerData) {
        setData(data.filter(d => d.ticker !== item.ticker))
    }

    /**
     * Clear all custom tickers
     */
    function clearCustomTickers() {
        setData([])
    }

    /**
     * Check if a ticker exists
     */
    function hasCustomTicker(ticker: string): boolean {
        return data.some(t => t.ticker === ticker);
    }

    return {
        data,
        count: data.length,
        addCustomTicker,
        removeCustomTicker,
        clearCustomTickers,
        hasCustomTicker
    }
}