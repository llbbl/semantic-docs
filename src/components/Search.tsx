/**
 * Semantic Search Component
 *
 * Command dialog with ⌘K keyboard shortcut
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

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
  maxResults = 10,
}: SearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle ⌘K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search function
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
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
  const handleValueChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value.length >= 2) {
        searchTimeoutRef.current = setTimeout(() => {
          performSearch(value);
        }, 300);
      } else {
        setResults([]);
      }
    },
    [performSearch],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Group results by folder
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.folder]) {
        acc[result.folder] = [];
      }
      acc[result.folder].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full h-10 flex items-center justify-center sm:justify-start px-2 py-2 text-left text-sm bg-muted/50 border border-input rounded-lg hover:bg-muted transition-colors sm:px-3 sm:pl-10"
        aria-label="Search"
      >
        <svg
          className="h-4 w-4 text-muted-foreground sm:absolute sm:left-3 sm:top-1/2 sm:-translate-y-1/2"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="text-muted-foreground truncate hidden sm:inline">
          {placeholder}
        </span>
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={handleValueChange}
        />
        <CommandList>
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {error && (
            <div className="py-4 px-2 text-center text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found for "{query}"</CommandEmpty>
          )}
          {!loading && !error && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search...
            </div>
          )}
          {!loading &&
            !error &&
            Object.entries(groupedResults).map(([folder, folderResults]) => (
              <CommandGroup key={folder} heading={folder.toUpperCase()}>
                {folderResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => {
                      window.location.href = `/content/${result.slug}`;
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1 cursor-pointer"
                  >
                    <div className="font-medium text-sm">{result.title}</div>
                    {result.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
