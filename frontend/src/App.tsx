
import Legend from "./components/legend";
import "./App.css"
import { useState, useMemo } from "react";
import { useBatchStocks } from "./hooks/useStocks";
import AsyncSelect from 'react-select/async';
import type { MultiValue } from 'react-select';
import { searchTickers } from './api/stocks';
import Canvas from "./components/canvas/canvas";
import type { SnapshotEntry } from "./components/canvas/types";
import { ShowAllButton } from "./components/show-all-button";
import { isDefined } from "./lib/utils";

interface OptionType {
  value: string;
  label: string;
}

function App() {
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [snapshotStocks, setSnapshotStocks] = useState<SnapshotEntry[] | null>(null);

  // Fetch data for selected stocks
  const {
    data: stocksData,
    isLoading: stocksLoading,
    isError: stocksError
  } = useBatchStocks(selectedStocks, selectedStocks.length > 0)

  // ── AsyncSelect load ─────────────────────────────────────────────────────
  const loadOptions = async (inputValue: string): Promise<OptionType[]> => {
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

  const handleChange = (selected: MultiValue<OptionType>) => {
    setSelectedStocks(selected.map(option => option.value));
    setSnapshotStocks(null); // Clear snapshot if user selects manually
  };

  // Get current selected options for react-select
  const selectedOptions = useMemo(() => {
    return selectedStocks.map(ticker => ({
      value: ticker,
      label: ticker,
    }));
  }, [selectedStocks]);

  // ── Canvas stocks  ─────────────────────────────────────────────────────

  // When snapshot is active, show all snapshot stocks on the canvas.
  // Otherwise show individually selected stocks.
  const stocksForCanvas = useMemo(() => {
    if (snapshotStocks) return snapshotStocks;

    return selectedStocks
      .map(ticker => {
        const data = stocksData?.data?.[ticker]
        return data ? { ticker, ...data } : null;
      })
      .filter(isDefined); // Boolean
  }, [snapshotStocks, selectedStocks, stocksData]);

  return (
    <div className="container">
      <h1>Dividend Yield</h1>

      {/* Show All Stocks button — triggers background job */}
      <ShowAllButton onData={setSnapshotStocks} />


      {/* Individual stock search — hidden while snapshot is active */}
      {!snapshotStocks && (
        <div className="controls">
          <div className="stock-selector">
            <label htmlFor="stock-select">Select Stocks:</label>
            <AsyncSelect<OptionType, true>
              id="stock-select"
              isMulti
              cacheOptions              // Cache search results
              defaultOptions={false}    // Don't load options on mount
              loadOptions={loadOptions} // Load options as user types
              value={selectedOptions}
              onChange={handleChange}
              placeholder="Type to search stocks (e.g., AAPL)..."
              className="react-select-container"
              classNamePrefix="react-select"
              closeMenuOnSelect={false}
              noOptionsMessage={({ inputValue }) =>
                inputValue
                  ? `No stocks found matching "${inputValue}"`
                  : "Type to search for stocks"
              }
              loadingMessage={() => "Searching..."}
              isSearchable
              menuPlacement="auto"

              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '42px',
                  borderColor: '#ddd',
                }),
                multiValue: (base) => ({
                  ...base,
                  backgroundColor: '#e3f2fd',
                }),
                multiValueLabel: (base) => ({
                  ...base,
                  color: '#1976d2',
                  fontWeight: 500,
                }),
                multiValueRemove: (base) => ({
                  ...base,
                  color: '#1976d2',
                  ':hover': {
                    backgroundColor: '#1976d2',
                    color: 'white',
                  },
                }),
              }}


            // Performance - debounce search
            // (AsyncSelect handles this internally, but you can add more delay if needed)
            />

            <div className="help-text">
              Start typing a stock ticker to see suggestions
            </div>
          </div>

          {selectedStocks.length > 0 && (
            <div className="selected-info">
              <span className="stock-count">
                {selectedStocks.length} stock{selectedStocks.length !== 1 ? 's' : ''} selected
              </span>
              {stocksLoading && (
                <span className="loading-indicator">
                  <div className="mini-spinner"></div>
                  Loading data...
                </span>
              )}
              {stocksError && (
                <span className="error-indicator">⚠️ Error loading some stocks</span>
              )}
              <button
                className="clear-button"
                onClick={() => setSelectedStocks([])}
                title="Clear all selections"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Back to search button when snapshot is showing */}
      {snapshotStocks && (
        <button
          className="clear-button"
          style={{ marginBottom: 16 }}
          onClick={() => setSnapshotStocks(null)}
        >
          ← Back to search
        </button>
      )}

      <Canvas
        stocks={stocksForCanvas}
        loading={stocksLoading && !snapshotStocks}
      />

      <Legend />

      {stocksData?.errors && Object.keys(stocksData.errors).length > 0 && (
        <div className="warnings">
          <h3>⚠️ Some stocks failed to load:</h3>
          <ul>
            {Object.entries(stocksData.errors).map(([ticker, error]) => (
              <li key={ticker}>
                <strong>{ticker}</strong>: {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default App