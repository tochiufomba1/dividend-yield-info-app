import type { StockPosition } from './types';

/**
 * Get mouse position relative to canvas
 */
function getMousePos(
  canvas: HTMLCanvasElement,
  event: React.MouseEvent<HTMLCanvasElement>
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

/**
 * Calculate distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Find stock at mouse position
 */
function findStockAtPosition(
  mouseX: number,
  mouseY: number,
  stockPositions: Map<string, StockPosition>
): StockPosition | null {
  let closestStock: StockPosition | null = null;
  let closestDistance = Infinity;

  stockPositions.forEach((position) => {
    const dist = distance(mouseX, mouseY, position.x, position.y);
    
    // Check if within hit radius and closer than previous
    if (dist < position.radius && dist < closestDistance) {
      closestStock = position;
      closestDistance = dist;
    }
  });

  return closestStock;
}

/**
 * Format tooltip content
 */
function formatTooltipContent(stock: StockPosition): string {
  const { data } = stock;
  
  return `
    <div class="tooltip-content">
      <div class="tooltip-header">
        <strong>${data.ticker}</strong>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-row">
          <span class="tooltip-label">Name:</span>
          <span class="tooltip-value">${data.name}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Sector:</span>
          <span class="tooltip-value">${data.sector}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Dividend Yield:</span>
          <span class="tooltip-value">${data.yield.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Position tooltip near mouse cursor
 */
function positionTooltip(
  tooltip: HTMLDivElement,
  event: React.MouseEvent<HTMLCanvasElement>,
  offset: { x: number; y: number } = { x: 15, y: 15 }
): void {
  tooltip.style.left = `${event.clientX + offset.x}px`;
  tooltip.style.top = `${event.clientY + offset.y}px`;
}

/**
 * Main tooltip handler
 * Finds stock at mouse position and shows/hides tooltip accordingly
 */
export function populateToolTip(
  event: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  tooltip: HTMLDivElement,
  stockPositions: Map<string, StockPosition>
): void {
  const mousePos = getMousePos(canvas, event);
  const stock = findStockAtPosition(mousePos.x, mousePos.y, stockPositions);

  if (stock) {
    // Show tooltip with stock data
    tooltip.innerHTML = formatTooltipContent(stock);
    tooltip.style.display = 'block';
    positionTooltip(tooltip, event);
    
    // Change cursor to pointer
    canvas.style.cursor = 'pointer';
  } else {
    // Hide tooltip
    tooltip.style.display = 'none';
    canvas.style.cursor = 'crosshair';
  }
}

/**
 * Hide tooltip (for mouse leave events)
 */
export function hideTooltip(tooltip: HTMLDivElement): void {
  tooltip.style.display = 'none';
}