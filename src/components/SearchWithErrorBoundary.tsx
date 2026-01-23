/**
 * Search component wrapped with ErrorBoundary
 * Provides graceful fallback if Search component fails to render
 */

import { ErrorBoundary } from './ErrorBoundary';
import Search, { type SearchProps } from './Search';

function SearchFallback() {
  return (
    <button
      type="button"
      className="relative w-full h-10 flex items-center justify-center sm:justify-start px-2 py-2 text-left text-sm bg-muted/50 border border-input rounded-lg text-muted-foreground cursor-not-allowed sm:px-3 sm:pl-10"
      disabled
      aria-label="Search unavailable"
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
      <span className="hidden sm:inline">Search unavailable</span>
    </button>
  );
}

export default function SearchWithErrorBoundary(props: SearchProps) {
  return (
    <ErrorBoundary fallback={<SearchFallback />}>
      <Search {...props} />
    </ErrorBoundary>
  );
}
