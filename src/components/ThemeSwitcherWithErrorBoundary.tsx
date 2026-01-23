/**
 * ThemeSwitcher component wrapped with ErrorBoundary
 * Provides graceful fallback if ThemeSwitcher component fails to render
 */

import { ErrorBoundary } from './ErrorBoundary';
import ThemeSwitcher from './ThemeSwitcher';

function ThemeSwitcherFallback() {
  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 text-muted-foreground cursor-not-allowed"
        disabled
        aria-label="Theme switcher unavailable"
      >
        <svg
          className="h-4 w-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      </button>
    </div>
  );
}

export default function ThemeSwitcherWithErrorBoundary() {
  return (
    <ErrorBoundary fallback={<ThemeSwitcherFallback />}>
      <ThemeSwitcher />
    </ErrorBoundary>
  );
}
