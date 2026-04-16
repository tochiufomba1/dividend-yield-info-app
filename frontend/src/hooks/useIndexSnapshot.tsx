import { useState, useEffect, useCallback, useRef } from 'react';
import type { StockData } from '../api/stocks'
import type { ActiveSnapshotState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

type IndexType = 'NASDAQ100' | 'SP500' | 'DOWJONES';
type JobStatus = 'idle' | 'running' | 'failed';

export interface IndexSnapshot {
    success: boolean;
    indexType: IndexType;
    data: Array<StockData>;
    metadata: {
        totalStocks: number;
        successfulFetches: number;
        failedFetches: number;
        averageYield: number;
        fetchedAt: string;
    };
}

interface IndexProgress {
    indexType: IndexType;
    completed: number;
    total: number;
    startedAt: string;
    estimatedMinutes: number;
}

interface UseIndexSnapshotState {
    status: JobStatus;
    progress: IndexProgress | null;
    data: IndexSnapshot | null;
    error: string | null;
    isLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook for fetching index snapshots (NASDAQ-100, S&P 500, etc.)
 * Handles loading, progress tracking, and data fetching
 */
export function useIndexSnapshot(indexType: IndexType) {
    const [state, setState] = useState<UseIndexSnapshotState>({
        status: 'idle',
        progress: null,
        data: null,
        error: null,
        isLoading: true,
    });

    const eventSourceRef = useRef<EventSource | null>(null);

    const closeStream = useCallback(() => {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
    }, []);

    const subscribeToProgress = useCallback(() => {
        if (eventSourceRef.current) return;

        const source = new EventSource(
            `${BACKEND}/api/index/${indexType}/progress`
        );
        eventSourceRef.current = source;

        source.onmessage = (event) => {
            const { status, progress } = JSON.parse(event.data);

            setState(prev => ({ ...prev, status, progress }));

            if (status === 'idle') {
                closeStream();
                fetchSnapshot();
            }
        };

        source.onerror = () => {
            setState(prev => ({
                ...prev,
                status: 'failed',
                error: 'Lost connection to server.'
            }));
            closeStream();
        };
    }, [indexType, closeStream]);

    const fetchSnapshot = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, isLoading: true }));

            const res = await fetch(`${BACKEND}/api/index/${indexType}`);
            const body = await res.json();

            if (!res.ok) {
                if (body.error === 'NOT_READY') {
                    const statusRes = await fetch(
                        `${BACKEND}/api/index/${indexType}/status`
                    );
                    const statusBody = await statusRes.json();

                    setState(prev => ({
                        ...prev,
                        status: statusBody.status,
                        progress: statusBody.progress,
                        isLoading: false,
                    }));

                    if (statusBody.status === 'running') {
                        subscribeToProgress();
                    }
                } else {
                    setState(prev => ({
                        ...prev,
                        error: body.message,
                        isLoading: false,
                    }));
                }
                return;
            }

            setState(prev => ({
                ...prev,
                status: 'idle',
                progress: null,
                data: body,
                error: null,
                isLoading: false,
            }));
        } catch (err) {
            setState(prev => ({
                ...prev,
                error: 'Failed to fetch snapshot.',
                isLoading: false,
            }));
        }
    }, [indexType, subscribeToProgress]);

    const triggerJob = useCallback(async () => {
        setState(prev => ({ ...prev, error: null }));

        try {
            const res = await fetch(`${BACKEND}/api/index/${indexType}/trigger`, {
                method: 'POST',
            });
            const body = await res.json();

            if (!res.ok) {
                setState(prev => ({ ...prev, error: body.message }));
                return;
            }

            setState(prev => ({ ...prev, status: 'running' }));
            subscribeToProgress();
        } catch {
            setState(prev => ({
                ...prev,
                error: 'Failed to trigger snapshot job.'
            }));
        }
    }, [indexType, subscribeToProgress]);

    useEffect(() => {
        fetchSnapshot();
        return closeStream;
    }, [fetchSnapshot, closeStream]);

    const percentComplete = state.progress
        ? Math.round((state.progress.completed / state.progress.total) * 100)
        : 0;

    return {
        ...state,
        percentComplete,
        triggerJob,
        refetch: fetchSnapshot,
        isRunning: state.status === 'running',
        isReady: state.data !== null,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface IndexSnapshotButtonProps {
    indexType: IndexType;
    onData: (data: ActiveSnapshotState) => void;
    label?: string;
}

export function IndexSnapshotButton({
    indexType,
    onData,
    label
}: IndexSnapshotButtonProps) {
    const {
        progress,
        data,
        error,
        isLoading,
        isRunning,
        isReady,
        triggerJob,
    } = useIndexSnapshot(indexType);

    const displayLabel = label || `Show ${indexType}`;

    // Ready state
    if (isReady && data) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full'
                        onClick={() => onData({ snapshotName: displayLabel, snapshotStocks: data.data })}>
                        {displayLabel} Stocks
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {data.data.length} stocks • Avg yield: {data.metadata.averageYield.toFixed(2)}%
                </TooltipContent>
            </Tooltip>
            // <div className="index-snapshot-ready">
            //     <span className="index-badge">{indexType}</span>
            //     <span className="index-info">
            //         {data.data.length} stocks •
            //         Avg yield: {data.metadata.averageYield.toFixed(2)}%
            //     </span>
            // </div>
        );
    }

    // Running state
    if (isRunning && progress) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full'
                        disabled={true}>
                        Building {displayLabel} snapshot...
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {progress.completed} / {progress.total}{' '}(~{progress.estimatedMinutes} min remaining)
                </TooltipContent>
            </Tooltip>
        );
    }

    // Error state
    if (error) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={triggerJob}>Retry</Button>
                </TooltipTrigger>
                <TooltipContent>
                    ⚠️ {error}
                </TooltipContent>
            </Tooltip>
            // <div className="index-snapshot-error">
            //     <span className="error-text">⚠️ {error}</span>
            //     <button className="index-trigger-btn" onClick={triggerJob}>
            //         Retry
            //     </button>
            // </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <Button disabled={true}>Loading {indexType}...</Button>
        );
    }

    // Default: show trigger button
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={triggerJob}>Retry</Button>
            </TooltipTrigger>
            <TooltipContent>
                {`Load all ${indexType} constituent stocks`}
            </TooltipContent>
        </Tooltip>
        // <button
        //     className="index-trigger-btn"
        //     onClick={triggerJob}
        //     disabled={isRunning}
        //     title={`Load all ${indexType} constituent stocks`}
        // >
        //     {displayLabel}
        // </button>
    );
}