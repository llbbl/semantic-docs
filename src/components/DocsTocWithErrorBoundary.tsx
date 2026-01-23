/**
 * DocsToc component wrapped with ErrorBoundary
 * Provides graceful fallback if DocsToc component fails to render
 */

import DocsToc from './DocsToc';
import { ErrorBoundary } from './ErrorBoundary';

export default function DocsTocWithErrorBoundary() {
  return (
    <ErrorBoundary fallback={null}>
      <DocsToc />
    </ErrorBoundary>
  );
}
