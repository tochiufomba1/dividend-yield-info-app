import type { StockData, StockPosition, CanvasConfig, Sector, SectorAngles } from './types';

/**
 * Convert yield percentage to radius on canvas
 */
function yieldToRadius(yieldPercent: number, maxYield: number, maxRadius: number): number {
    return (yieldPercent / maxYield) * maxRadius;
}

/**
 * Get angle range for a sector
 */
function getSectorAngle(sectorName: string, sectors: Sector[]): SectorAngles {
    const index = sectors.findIndex(s => s.name === sectorName);
    const anglePerSector = (2 * Math.PI) / sectors.length;
    const startAngle = index * anglePerSector - Math.PI / 2; // Start from top

    return {
        start: startAngle,
        end: startAngle + anglePerSector,
        mid: startAngle + anglePerSector / 2
    };
}

/**
 * Draw concentric circles with yield labels
 */
function drawYieldCircles(
    ctx: CanvasRenderingContext2D,
    config: CanvasConfig
): void {
    const { centerX, centerY, maxRadius, yieldRanges } = config;

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';

    yieldRanges.forEach((yieldValue, i) => {
        if (i === 0) return; // Skip center point

        const radius = yieldToRadius(yieldValue, yieldRanges[yieldRanges.length - 1], maxRadius);

        // Draw circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw label
        ctx.fillText(`${yieldValue}%`, centerX + 5, centerY - radius + 5);
    });
}

/**
 * Draw sector divisions and backgrounds
 */
function drawSectors(
    ctx: CanvasRenderingContext2D,
    config: CanvasConfig,
    sectors: Sector[]
): void {
    const { centerX, centerY, maxRadius } = config;
    const anglePerSector = (2 * Math.PI) / sectors.length;

    sectors.forEach((sector, i) => {
        const angle = -Math.PI / 2 + i * anglePerSector;

        // Draw sector background
        ctx.beginPath();
        ctx.fillStyle = sector.color + '15'; // Add transparency
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, angle, angle + anglePerSector);
        ctx.closePath();
        ctx.fill();

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
}

/**
 * Draw center point
 */
function drawCenterPoint(
    ctx: CanvasRenderingContext2D,
    config: CanvasConfig
): void {
    const { centerX, centerY } = config;

    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
}

/**
 * Draw stocks and populate position map
 */
function drawStocks(
    ctx: CanvasRenderingContext2D,
    config: CanvasConfig,
    sectors: Sector[],
    stocks: StockData[],
    showLabels: boolean,
    stockPositions: Map<string, StockPosition>
): void {
    const { centerX, centerY, yieldRanges } = config;
    const maxYield = yieldRanges[yieldRanges.length - 1];

    stocks.forEach(stock => {
        const angles = getSectorAngle(stock.sector, sectors);
        const radius = yieldToRadius(stock.yield, maxYield, config.maxRadius);

        // Add random variation within sector (deterministic based on ticker)
        const seed = stock.ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const angleVariation = ((seed % 100) / 100 - 0.5) * (angles.end - angles.start) * 0.8;
        const angle = angles.mid + angleVariation;

        // Calculate position
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Store position for hit detection (don't mutate stock data!)
        stockPositions.set(stock.ticker, {
            ticker: stock.ticker,
            x,
            y,
            radius: 10, // Hit detection radius
            data: stock
        });

        // Get sector color
        const sector = sectors.find(s => s.name === stock.sector);
        const color = sector?.color || '#666';

        // Draw stock point
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label if enabled
        if (showLabels) {
            ctx.fillStyle = '#333';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(stock.ticker, x, y - 10);
        }
    });
}

/**
 * Main draw function
 */
export function draw(
    ctx: CanvasRenderingContext2D,
    config: CanvasConfig,
    sectors: Sector[],
    stocks: StockData[],
    showLabels: boolean,
    stockPositions: Map<string, StockPosition>,
    transform: any
): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.offsetX, transform.offsetY)

    // Draw layers in order
    drawYieldCircles(ctx, config);
    drawSectors(ctx, config, sectors);
    drawStocks(ctx, config, sectors, stocks, showLabels, stockPositions);
    drawCenterPoint(ctx, config);
}