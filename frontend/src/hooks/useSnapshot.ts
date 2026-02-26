import type { JobProgress, JobStatus, SnapshotEntry } from "@/components/canvas/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface SnapshotState {
    status: JobStatus;
    progress: JobProgress | null;
    data: SnapshotEntry[] | null;
    error: string | null;
}

/**
 * Manages fetching the pre-built snapshot and streaming live progress
 * when the job is still running.
 */
export function useSnapshot() {
    const [state, setState] = useState<SnapshotState>({
        status: 'idle',
        progress: null,
        data: null,
        error: null,
    });

    const eventSourceRef = useRef<EventSource | null>(null);

    // Close the SSE connection when done or on unmount
    const closeStream = useCallback(() => {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
    }, []);

    // Subscribe to live progress updates via Server-Sent Events
    const subscribeToProgress = useCallback(() => {
        if (eventSourceRef.current) return; // Already subscribed

        const source = new EventSource(`${import.meta.env.VITE_API_URL}/api/snapshot/progress`);
        eventSourceRef.current = source;

        source.onmessage = (event) => {
            const { status, progress } = JSON.parse(event.data) as {
                status: JobStatus;
                progress: JobProgress | null;
            };

            setState(prev => ({ ...prev, status, progress }));

            // Job finished — fetch the completed snapshot
            if (status === 'idle') {
                closeStream();
                fetchSnapshot();
            }
        };

        source.onerror = () => {
            setState(prev => ({ ...prev, status: 'failed', error: 'Lost connection to server.' }));
            closeStream();
        };
    }, [closeStream]);

    // Fetch the finished snapshot from the REST endpoint
    const fetchSnapshot = useCallback(async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/snapshot`);
            const body = await res.json();

            if (!res.ok) {
                // Snapshot not ready yet — job may be running
                if (body.error === 'NOT_READY') {
                    const statusRes = await fetch(`${import.meta.env.VITE_API_URL}/api/snapshot/status`);
                    const statusBody = await statusRes.json();

                    setState(prev => ({
                        ...prev,
                        status: statusBody.status,
                        progress: statusBody.progress,
                    }));

                    if (statusBody.status === 'running') {
                        subscribeToProgress();
                    }
                } else {
                    setState(prev => ({ ...prev, error: body.message }));
                }
                return;
            }

            setState(prev => ({
                ...prev,
                status: 'idle',
                progress: null,
                data: body.data,
                error: null,
            }));
        } catch (err) {
            setState(prev => ({ ...prev, error: 'Failed to fetch snapshot.' }));
        }
    }, [subscribeToProgress]);

    // Trigger the background job manually (button click)
    const triggerJob = useCallback(async () => {
        setState(prev => ({ ...prev, error: null }));

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/snapshot/trigger`, { method: 'POST' });
            const body = await res.json();

            if (!res.ok) {
                setState(prev => ({ ...prev, error: body.message }));
                return;
            }

            setState(prev => ({ ...prev, status: 'running' }));
            subscribeToProgress();
        } catch {
            setState(prev => ({ ...prev, error: 'Failed to trigger snapshot job.' }));
        }
    }, [subscribeToProgress]);

    // Initialise: check whether a snapshot already exists
    useEffect(() => {
        fetchSnapshot();
        return closeStream; // Cleanup on unmount
    }, []);

    const percentComplete = state.progress
        ? Math.round((state.progress.completed / state.progress.total) * 100)
        : 0;

    return {
        ...state,
        percentComplete,
        triggerJob,
        isRunning: state.status === 'running',
        isReady: state.data !== null,
    };
}