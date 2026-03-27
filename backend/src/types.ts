// Types
export interface StockData {
    ticker: string;
    name: string;
    GICS_Sector: string;
    ImSquare_Sector: string;
    yield: number;
}

export interface AlphaVantageResponse {
    Name?: string;
    Symbol?: string;
    Sector?: string;
    DividendYield?: string;
    Note?: string; // API rate limit message
    'Error Message'?: string;
}

export interface SECTickerResponse {
    [key: string]: {
        cik_str: number;
        ticker: string;
        title: string;
    };
}

// Custom errors
export class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitError';
    }
}

export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}