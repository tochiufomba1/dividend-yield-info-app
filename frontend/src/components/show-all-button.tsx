import { useSnapshot } from "@/hooks/useSnapshot";
import type { SnapshotEntry } from "./canvas/types";
import { useEffect } from "react";

interface ShowAllButtonProps {
    onData: (data: SnapshotEntry[]) => void;
}

export function ShowAllButton({ onData }: ShowAllButtonProps) {
    const {
        progress,
        data,
        error,
        percentComplete,
        isRunning,
        isReady,
        triggerJob,
    } = useSnapshot();

    // Pass data up when it arrives
    useEffect(() => {
        if (data) {
            onData(data);
        }
    }, [data, onData]);

    // ── Already have data ───────────────────────────────────────────────────
    if (isReady) {
        return (
            <div className="show-all-container">
                <span className="snapshot-ready">
                    ✅ {data!.length} dividend-paying stocks loaded
                </span>
            </div>
        );
    }

    // ── Job is running ───────────────────────────────────────────────────────
    if (isRunning && progress) {
        return (
            <div className="show-all-container">
                <p className="snapshot-status">
                    Building snapshot… {progress.completed} / {progress.total} tickers
                    {' '}(~{progress.estimatedMinutes} min remaining)
                </p>
                <div className="progress-bar-track">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${percentComplete}%` }}
                    />
                </div>
                <span className="progress-percent">{percentComplete}%</span>
            </div>
        );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="show-all-container">
                <span className="snapshot-error">⚠️ {error}</span>
                <button className="show-all-btn" onClick={triggerJob}>
                    Retry
                </button>
            </div>
        );
    }

    // ── Default: prompt user to trigger the job ──────────────────────────────
    return (
        <div className="show-all-container">
            <button
                className="show-all-btn"
                onClick={triggerJob}
                disabled={isRunning}
                title="Fetches all dividend-paying stocks in the background. This may take several minutes."
            >
                Show All Dividend Stocks
            </button>
            <span className="show-all-hint">
                ⏱ This builds a full dataset and may take a few minutes
            </span>
        </div>
    );
}