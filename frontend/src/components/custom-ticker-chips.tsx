import type { CustomTickerData } from '../hooks/useCustomTickers';
import './CustomTickerChips.css';

interface CustomTickerChipsProps {
  tickers: CustomTickerData[];
  onRemove: (ticker: CustomTickerData) => void;
  onClearAll?: () => void;
}

/**
 * Simple chip display for custom tickers with remove buttons
 * Similar to react-select's multi-value display
 */
export function CustomTickerChips({ 
  tickers, 
  onRemove,
  onClearAll 
}: CustomTickerChipsProps) {
  if (tickers.length === 0) {
    return null;
  }

  return (
    <div className="custom-ticker-container">
      <div className="custom-ticker-header">
        <span className="custom-ticker-label">
          Custom Investments ({tickers.length})
        </span>
        {onClearAll && tickers.length > 1 && (
          <button 
            className="clear-all-btn"
            onClick={onClearAll}
            type="button"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="custom-ticker-chips">
        {tickers.map((ticker) => (
          <div key={ticker.ticker} className="custom-ticker-chip">
            <div className="chip-content">
              <span className="chip-ticker">{ticker.ticker}</span>
              <span className="chip-yield">{ticker.yield.toFixed(2)}%</span>
            </div>
            <button
              className="chip-remove"
              onClick={() => onRemove(ticker)}
              aria-label={`Remove ${ticker.ticker}`}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}