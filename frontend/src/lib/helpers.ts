import { searchTickers, type StockData } from "@/api/stocks";
import type { OptionType } from "./types";

// Convert yield to radius
function yieldToRadius(yieldPercent: number, yieldRanges: number[], maxRadius: number) {
    const maxYield = yieldRanges[yieldRanges.length - 1];
    return (yieldPercent / maxYield) * maxRadius;
}

// Get angle for sector
function getSectorAngle(sectorName: string, sectors: any[]) {
    const index = sectors.findIndex(s => s.name === sectorName);
    const anglePerSector = (2 * Math.PI) / sectors.length;
    const startAngle = index * anglePerSector - Math.PI / 2; // Start from top
    return {
        start: startAngle,
        end: startAngle + anglePerSector,
        mid: startAngle + anglePerSector / 2
    };
}

export function draw(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    yieldRanges: number[],
    maxRadius: number,
    centerX: number,
    centerY: number,
    sectors: any[],
    stocks: any[],
    showLabels: boolean,
) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw concentric circles with labels
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';

    yieldRanges.forEach((yield_, i) => {
        if (i === 0) return; // Skip center
        const radius = yieldToRadius(yield_, yieldRanges, maxRadius);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Label the yield percentage
        ctx.fillText(`${yield_}%`, centerX + 5, centerY - radius + 5);
    });

    // Draw sector divisions
    const anglePerSector = (2 * Math.PI) / sectors.length;
    sectors.forEach((sector, i) => {
        const angle = -Math.PI / 2 + i * anglePerSector;

        // Draw dividing line
        ctx.beginPath();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1.5;
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + maxRadius * Math.cos(angle),
            centerY + maxRadius * Math.sin(angle)
        );
        ctx.stroke();

        // Fill sector with light color
        ctx.beginPath();
        ctx.fillStyle = sector.color + '15'; // Add transparency
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, angle, angle + anglePerSector);
        ctx.closePath();
        ctx.fill();

        // Draw sector label
        const labelAngle = angle + anglePerSector / 2;
        const labelRadius = maxRadius + 30;
        const labelX = centerX + labelRadius * Math.cos(labelAngle);
        const labelY = centerY + labelRadius * Math.sin(labelAngle);

        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate(labelAngle + Math.PI / 2);
        ctx.fillStyle = sector.color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sector.name, 0, 0);
        ctx.restore();
    });

    // Draw stocks as points
    stocks.forEach(stock => {
        const angles = getSectorAngle(stock.sector, sectors);
        const radius = yieldToRadius(stock.yield, yieldRanges, maxRadius);

        // Random position within sector slice
        const angleVariation = (Math.random() - 0.5) * (angles.end - angles.start) * 0.8;
        const angle = angles.mid + angleVariation;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Store position for hover detection
        stock.x = x;
        stock.y = y;

        // Draw point
        const sector = sectors.find(s => s.name === stock.sector);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = sector.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label if enabled
        if (showLabels) {
            ctx.fillStyle = '#333';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(stock.name, x, y - 10);
        }
    });

    // Draw center point
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
}

export function populateToolTip(
    e: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
    canvas: React.RefObject<HTMLCanvasElement | null>,
    tooltip: React.RefObject<HTMLDivElement | null>,
    stocks: any[],
) {
    if (!canvas.current || !tooltip.current)
        return

    const rect = canvas.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let foundStock: any | null = null;
    stocks.forEach(stock => {
        const distance = Math.sqrt(
            Math.pow(mouseX - stock.x, 2) + Math.pow(mouseY - stock.y, 2)
        );
        if (distance < 10) {
            foundStock = stock;
        }
    });

    if (foundStock) {
        tooltip
        tooltip.current.style.display = 'block';
        tooltip.current.style.left = (e.clientX + 15) + 'px';
        tooltip.current.style.top = (e.clientY + 15) + 'px';
        tooltip.current.innerHTML = `
                    <strong>${foundStock.name}</strong><br>
                    Sector: ${foundStock.sector}<br>
                    Dividend Yield: ${foundStock.yield.toFixed(2)}%
                `;
        canvas.current.style.cursor = 'pointer';
    } else {
        tooltip.current.style.display = 'none';
        canvas.current.style.cursor = 'crosshair';
    }
}

// ── AsyncSelect load ─────────────────────────────────────────────────────
export const loadOptions = async (inputValue: string): Promise<OptionType[]> => {
    try {
        // Don't search for very short queries
        if (!inputValue) return [];

        // Search backend for matching tickers
        const tickers = await searchTickers(inputValue, 50);

        // Convert to react-select format
        return tickers.map(ticker => ({
            value: ticker,
            label: ticker,
        }));
    } catch (error) {
        console.error('Error loading options:', error);
        return [];
    }
};

/**
 * Calculate dynamic yield ranges for the canvas using the 95th percentile
 */
export function calculateYieldRangesPercentile(
    stocks: StockData[],
    numRanges: number = 6,
    percentile: number = 95
): number[] {
    if (stocks.length === 0) {
        return [0, 2, 4, 6, 8, 10]; // Fallback
    }

    // Extract all yields
    const yields = stocks.map(s => s.yield).filter(y => y > 0);

    if (yields.length === 0) {
        return [0, 2, 4, 6, 8, 10];
    }

    // Sort yields
    const sorted = [...yields].sort((a, b) => a - b);

    // Get percentile value
    const index = Math.floor((percentile / 100) * sorted.length);
    const maxYield = sorted[Math.min(index, sorted.length - 1)];

    // Round up to next nice number (2, 5, 10, 20, 50, etc.)
    const roundedMax = roundToNiceNumber(maxYield);

    // Generate evenly spaced ranges
    const ranges: number[] = [0];
    const step = roundedMax / (numRanges - 1);

    for (let i = 1; i < numRanges; i++) {
        ranges.push(Math.round(step * i * 10) / 10); // Round to 1 decimal
    }

    return ranges;
}

/**
 * Round to a "nice" number for cleaner axis labels
 * Examples: 7.3 → 10, 23 → 25, 47 → 50
 */
function roundToNiceNumber(value: number): number {
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;

    let nice: number;
    if (normalized < 1.5) {
        nice = 2;
    } else if (normalized < 3) {
        nice = 5;
    } else if (normalized < 7) {
        nice = 10;
    } else {
        nice = 10;
    }

    return nice * magnitude;
}