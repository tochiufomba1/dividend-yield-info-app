import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { draw } from './canvasUtils';
import { sectors } from './constants';
import type { StockData, StockPosition, CanvasConfig } from './types';

interface CanvasProps {
    stocks: StockData[];
    loading?: boolean;
    className?: string;
    width?: number;
    height?: number;
    showLabels?: boolean;
}

interface Transform {
    scale: number;
    offsetX: number;
    offsetY: number;
}

export default function Canvas({
    stocks,
    loading = false,
    className,
    width = 800,
    height = 800,
    showLabels = true,
}: CanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Store calculated positions without mutating stock data
    const stockPositionsRef = useRef<Map<string, StockPosition>>(new Map());

    // Transform state for zoom and pan
    const [transform, setTransform] = useState<Transform>({
        scale: 1,
        offsetX: 0,
        offsetY: 0
    });

    // Panning state
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Canvas configuration - memoize to prevent recalculation
    const config = useMemo<CanvasConfig>(() => ({
        centerX: width / 2,
        centerY: height / 2,
        maxRadius: Math.min(width, height) * 0.4375, // 350/800 ratio
        yieldRanges: [0, 10, 20, 30, 40, 50],
    }), [width, height]);

    // Draw function - memoized with useCallback
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear previous positions
        stockPositionsRef.current.clear();

        // Draw and get stock positions
        draw(
            ctx,
            config,
            sectors,
            stocks,
            showLabels && transform.scale > 0.8, // Hide labels when zoomed out
            stockPositionsRef.current, // Pass ref to be populated
            transform
        );
    }, [transform, config, stocks, showLabels]);

    // Redraw when dependencies change
    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);


    // Convert mouse coordinates to canvas space considering transform
    const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left - transform.offsetX) / transform.scale;
        const y = (clientY - rect.top - transform.offsetY) / transform.scale;

        return { x, y };
    }, [transform]);

    // Handle mouse wheel for zooming
    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setTransform(prev => {
            // Zoom delta
            const delta = -e.deltaY * 0.001;
            const newScale = Math.max(0.5, Math.min(5, prev.scale * (1 + delta)));

            // Calculate new offset to zoom toward mouse position
            const ratio = newScale / prev.scale;
            const newOffsetX = mouseX - (mouseX - prev.offsetX) * ratio;
            const newOffsetY = mouseY - (mouseY - prev.offsetY) * ratio;

            return {
                scale: newScale,
                offsetX: newOffsetX,
                offsetY: newOffsetY,
            };
        });
    }, []);

    // Handle mouse down for panning
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Only pan with left mouse button (or with Ctrl/Meta key for touchpad)
        if (e.button === 0) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });

            // Change cursor
            if (canvasRef.current) {
                canvasRef.current.style.cursor = 'grabbing';
            }
        }
    }, []);

    // Handle mouse move for panning and tooltips
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const tooltip = tooltipRef.current;

        if (!canvas || !tooltip) return;

        // Handle panning
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;

            setTransform(prev => ({
                ...prev,
                offsetX: prev.offsetX + dx,
                offsetY: prev.offsetY + dy,
            }));

            setPanStart({ x: e.clientX, y: e.clientY });

            // Hide tooltip while panning
            tooltip.style.display = 'none';
            return;
        }

        // Handle tooltip
        const canvasCoords = getCanvasCoordinates(e.clientX, e.clientY);

        // Find stock at position
        let foundStock: StockPosition | null = null;
        let minDistance = Infinity;

        // Adjust hit radius based on zoom level
        const hitRadius = 10 / transform.scale;

        stockPositionsRef.current.forEach((position) => {
            const dx = canvasCoords.x - position.x;
            const dy = canvasCoords.y - position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < hitRadius && distance < minDistance) {
                foundStock = position;
                minDistance = distance;
            }
        });

        if (foundStock) {
            // Show tooltip
            tooltip.innerHTML = `
        <div class="tooltip-content">
          <div class="tooltip-header">
            <strong>${foundStock.data.ticker}</strong>
          </div>
          <div class="tooltip-body">
            <div class="tooltip-row">
              <span class="tooltip-label">Name:</span>
              <span class="tooltip-value">${foundStock.data.name}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">Sector:</span>
              <span class="tooltip-value">${foundStock.data.sector}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">Dividend Yield:</span>
              <span class="tooltip-value">${foundStock.data.yield.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      `;
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;
            canvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
        }
    }, [isPanning, panStart, getCanvasCoordinates, transform.scale]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        if (canvasRef.current) {
            canvasRef.current.style.cursor = 'grab';
        }
    }, []);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        const tooltip = tooltipRef.current;
        if (tooltip) {
            tooltip.style.display = 'none';
        }
        setIsPanning(false);
        if (canvasRef.current) {
            canvasRef.current.style.cursor = 'grab';
        }
    }, []);

    // Reset zoom/pan
    const handleReset = useCallback(() => {
        setTransform({
            scale: 1,
            offsetX: 0,
            offsetY: 0,
        });
    }, []);

    // Handle mouse leave
    // const handleMouseLeave = useCallback(() => {
    //     const tooltip = tooltipRef.current;
    //     if (tooltip) {
    //         tooltip.style.display = 'none';
    //     }
    // }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Reset with 'R' key
            if (e.key === 'r' || e.key === 'R') {
                handleReset();
            }
            // Zoom in with '+'
            if (e.key === '+' || e.key === '=') {
                setTransform(prev => ({
                    ...prev,
                    scale: Math.min(5, prev.scale * 1.2),
                }));
            }
            // Zoom out with '-'
            if (e.key === '-' || e.key === '_') {
                setTransform(prev => ({
                    ...prev,
                    scale: Math.max(0.5, prev.scale / 1.2),
                }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleReset]);

    return (
        <div className={`canvas-container ${className || ''}`}>
            {loading && (
                <div className="canvas-loading">
                    <div className="spinner" />
                    <p>Loading stock data...</p>
                </div>
            )}

            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="dividend-canvas"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{ opacity: loading ? 0.5 : 1 }}
            />

            <div className="canvas-controls">
                <button
                    className="zoom-btn"
                    onClick={() => setTransform(prev => ({
                        ...prev,
                        scale: Math.min(5, prev.scale * 1.2)
                    }))}
                    title="Zoom in (+)"
                >
                    +
                </button>
                <span className="zoom-level">{Math.round(transform.scale * 100)}%</span>
                <button
                    className="zoom-btn"
                    onClick={() => setTransform(prev => ({
                        ...prev,
                        scale: Math.max(0.5, prev.scale / 1.2)
                    }))}
                    title="Zoom out (-)"
                >
                    −
                </button>
                <button
                    className="reset-btn"
                    onClick={handleReset}
                    title="Reset view (R)"
                >
                    Reset
                </button>
            </div>

            <div className="canvas-hint">
                💡 Scroll to zoom • Drag to pan • Press R to reset
            </div>

            <div ref={tooltipRef} className="tooltip" />
        </div>
    );
}