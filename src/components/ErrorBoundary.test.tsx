import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Child content')).toBeDefined();
  });

  it('should catch errors and render fallback', () => {
    const fallback = <div>Error fallback</div>;

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Error fallback')).toBeDefined();
  });

  it('should render null when no fallback is provided and error occurs', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // The container should be empty (only the wrapper element)
    expect(container.textContent).toBe('');
  });

  it('should log error to console', () => {
    render(
      <ErrorBoundary fallback={<div>Error</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle complex fallback components', () => {
    const ComplexFallback = (
      <div>
        <h1>Something went wrong</h1>
        <p>Please try again later</p>
      </div>
    );

    render(
      <ErrorBoundary fallback={ComplexFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('Please try again later')).toBeDefined();
  });

  it('should pass through when child does not throw', () => {
    render(
      <ErrorBoundary fallback={<div>Error</div>}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Normal content')).toBeDefined();
    expect(screen.queryByText('Error')).toBeNull();
  });
});
