/**
 * Semantic Search Component
 *
 * Real-time vector search using Turso embeddings
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  id: number;
  title: string;
  slug: string;
  folder: string;
  tags: string[];
  distance: number;
}

interface SearchProps {
  placeholder?: string;
  maxResults?: number;
}

export default function Search({
  placeholder = 'Search articles...',
  maxResults = 5,
}: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/search.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            limit: maxResults,
          }),
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data.results || []);
        setShowResults(true);
      } catch (err) {
        console.error('Search error:', err);
        setError('Search failed. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [maxResults],
  );

  // Handle input changes with debouncing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch],
  );

  // Handle clicks outside search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="search-container" ref={searchContainerRef}>
      <div className="search-input-wrapper">
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="search-input"
          aria-label="Search articles"
        />
        {loading && (
          <div className="search-spinner" aria-label="Loading">
            ⏳
          </div>
        )}
      </div>

      {error && (
        <div className="search-error" role="alert">
          {error}
        </div>
      )}

      {showResults && results.length > 0 && (
        <div className="search-results" role="listbox">
          {results.map((result) => (
            <a
              key={result.id}
              href={`/content/${result.slug}`}
              className="search-result"
              role="option"
              onClick={() => setShowResults(false)}
            >
              <div className="result-header">
                <h3 className="result-title">{result.title}</h3>
                <span className="result-folder">{result.folder}</span>
              </div>
              {result.tags.length > 0 && (
                <div className="result-tags">
                  {result.tags.map((tag, idx) => (
                    <span key={idx} className="result-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !loading && (
        <div className="search-no-results">No results found for "{query}"</div>
      )}

      <style>{`
        .search-container {
          position: relative;
          width: 100%;
          max-width: 500px;
        }

        .search-input-wrapper {
          position: relative;
        }

        .search-input {
          width: 100%;
          height: 2.5rem;
          padding-left: 2.5rem;
          padding-right: 1rem;
          font-size: 0.875rem;
          background-color: oklch(var(--muted) / 0.5);
          border: 1px solid transparent;
          border-radius: 0.5rem;
          color: var(--foreground);
          outline: none;
          transition: all 0.2s;
        }

        .search-input::placeholder {
          color: var(--muted-foreground);
        }

        .search-input:focus {
          background-color: var(--background);
          border-color: var(--ring);
        }

        .search-input-wrapper::before {
          content: '';
          position: absolute;
          left: 0.625rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1rem;
          height: 1rem;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
        }

        .search-spinner {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.25rem;
        }

        .search-error {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: #fee;
          color: #c33;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .search-results {
          position: absolute;
          top: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          background: var(--popover);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          box-shadow: 0 4px 12px oklch(0 0 0 / 0.1);
          max-height: 400px;
          overflow-y-auto;
          z-index: 100;
        }

        .search-result {
          display: block;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          text-decoration: none;
          color: var(--popover-foreground);
          transition: background-color 0.2s;
        }

        .search-result:last-child {
          border-bottom: none;
        }

        .search-result:hover {
          background-color: var(--accent);
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.25rem;
        }

        .result-title {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
        }

        .result-folder {
          font-size: 0.625rem;
          color: var(--muted-foreground);
          text-transform: uppercase;
          margin-left: 0.5rem;
          letter-spacing: 0.05em;
        }

        .result-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .result-tag {
          padding: 0.125rem 0.375rem;
          background: var(--muted);
          color: var(--muted-foreground);
          border-radius: 0.25rem;
          font-size: 0.625rem;
        }

        .search-no-results {
          position: absolute;
          top: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          padding: 1rem;
          background: var(--popover);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          color: var(--muted-foreground);
          font-size: 0.875rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
