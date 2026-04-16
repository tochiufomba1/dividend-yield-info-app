import { useSnapshot } from "@/hooks/useSnapshot";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Button } from '@/components/ui/button'
import type { ActiveSnapshotState } from "@/lib/types";

interface ShowAllButtonProps {
    onData: (data: ActiveSnapshotState) => void;
}

export function ShowAllButton({ onData }: ShowAllButtonProps) {
    const {
        progress,
        data,
        error,
        isRunning,
        isReady,
        triggerJob,
    } = useSnapshot();

    const displayLabel = 'Loaded Dividend Stocks'

    // ── Already have data ───────────────────────────────────────────────────
    if (isReady && data) {
        return (
            <div className="show-all-container">
                <Button onClick={() => { onData({ snapshotName: displayLabel, snapshotStocks: data }) }}>
                    ✅ {data!.length} dividend-paying stocks loaded
                </Button>
            </div>
        );
    }

    // ── Job is running ───────────────────────────────────────────────────────
    if (isRunning && progress) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button disabled={true}>Building snapshot of all tickers...</Button>
                </TooltipTrigger>
                <TooltipContent>
                    {progress.completed} / {progress.total} tickers{' '}(~{progress.estimatedMinutes} min remaining)
                </TooltipContent>
            </Tooltip>
        );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full'
                        onClick={triggerJob}>
                        Retry
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    ⚠️ {error}
                </TooltipContent>
            </Tooltip>
        );
    }

    // ── Default: prompt user to trigger the job ──────────────────────────────
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
                    onClick={triggerJob} disabled={isRunning}>Show All Dividend Stocks</Button>
            </TooltipTrigger>
            <TooltipContent>
                Fetches all dividend-paying stocks in the background. This may take several minutes.
            </TooltipContent>
        </Tooltip>
    );
}