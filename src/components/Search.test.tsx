import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Search from './Search';

// Mock fetch
global.fetch = vi.fn();

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createSearchResponse(id: number, title: string): Response {
  return {
    ok: true,
    json: async () => ({
      results: [
        {
          id,
          title,
          slug: title.toLowerCase().replaceAll(' ', '-'),
          folder: 'docs',
          tags: [],
          distance: 0.5,
        },
      ],
      count: 1,
      query: title,
    }),
  } as Response;
}

describe('Search Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search button', () => {
    render(<Search />);
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toBeDefined();
    expect(screen.getByText('Search articles...')).toBeDefined();
  });

  it('should open dialog when button clicked', async () => {
    render(<Search />);
    const button = screen.getByRole('button', { name: 'Search' });

    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search articles...');
      expect(input).toBeDefined();
    });
  });

  it('should not search when query is less than 2 characters', async () => {
    render(<Search />);
    const button = screen.getByRole('button', { name: 'Search' });

    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(input, { target: { value: 'a' } });
    });

    await waitFor(
      () => {
        expect(fetch).not.toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });

  it('should perform search with valid query', async () => {
    const mockResults = {
      results: [
        {
          id: 1,
          title: 'Test Article',
          slug: 'test',
          folder: 'docs',
          tags: ['test'],
          distance: 0.5,
        },
      ],
      count: 1,
      query: 'test',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    } as Response);

    render(<Search />);
    const button = screen.getByRole('button', { name: 'Search' });

    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(input, { target: { value: 'test' } });
    });

    await waitFor(
      () => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/search.json',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'test', limit: 10 }),
          }),
        );
      },
      { timeout: 500 },
    );
  });

  it('should display search results', async () => {
    const mockResults = {
      results: [
        {
          id: 1,
          title: 'Test Article',
          slug: 'test',
          folder: 'docs',
          tags: ['testing'],
          distance: 0.5,
        },
      ],
      count: 1,
      query: 'test',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    } as Response);

    render(<Search />);
    const button = screen.getByRole('button', { name: 'Search' });

    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(input, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Test Article')).toBeDefined();
      expect(screen.getByText('DOCS')).toBeDefined();
      expect(screen.getByText('testing')).toBeDefined();
    });
  });

  it('should let only the active request update results and loading state', async () => {
    const firstRequest = createDeferred<Response>();
    const secondRequest = createDeferred<Response>();
    vi.mocked(global.fetch)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    render(<Search />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const input = await screen.findByPlaceholderText('Search articles...');
    fireEvent.change(input, { target: { value: 'first query' } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), {
      timeout: 500,
    });
    const firstSignal = vi.mocked(global.fetch).mock.calls[0][1]?.signal;

    fireEvent.change(input, { target: { value: 'second query' } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), {
      timeout: 500,
    });
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      firstRequest.resolve(createSearchResponse(1, 'Stale Result'));
      await firstRequest.promise;
    });

    expect(screen.queryByText('Stale Result')).toBeNull();
    expect(screen.getByText('Searching...')).toBeDefined();

    await act(async () => {
      secondRequest.resolve(createSearchResponse(2, 'Second Query Result'));
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Second Query Result')).toBeDefined();
      expect(screen.queryByText('Searching...')).toBeNull();
    });
  });

  it('should abort and reset an active request when closed and reopened', async () => {
    const request = createDeferred<Response>();
    vi.mocked(global.fetch).mockReturnValueOnce(request.promise);

    render(<Search />);
    const searchButton = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchButton);

    const input = await screen.findByPlaceholderText('Search articles...');
    fireEvent.change(input, { target: { value: 'in flight' } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), {
      timeout: 500,
    });
    const signal = vi.mocked(global.fetch).mock.calls[0][1]?.signal;

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      request.resolve(createSearchResponse(1, 'Late Result'));
      await request.promise;
    });

    fireEvent.click(searchButton);
    const reopenedInput =
      await screen.findByPlaceholderText('Search articles...');

    expect((reopenedInput as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('Late Result')).toBeNull();
    expect(screen.queryByText('Searching...')).toBeNull();
    expect(screen.queryByText('Search failed. Please try again.')).toBeNull();
    expect(
      screen.getByText('Type at least 2 characters to search...'),
    ).toBeDefined();
  });

  it('should show no results message when no results found', async () => {
    const mockResults = {
      results: [],
      count: 0,
      query: 'nonexistent',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    } as Response);

    render(<Search />);
    const button = screen.getByRole('button', { name: 'Search' });

    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(input, { target: { value: 'nonexistent' } });
    });

    await waitFor(() => {
      expect(
        screen.getByText('No results found for "nonexistent"'),
      ).toBeDefined();
    });
  });

  it('should use custom placeholder', () => {
    render(<Search placeholder="Custom search..." />);
    expect(screen.getByText('Custom search...')).toBeDefined();
  });

  it('should respect maxResults prop', async () => {
    const mockResults = {
      results: [],
      count: 0,
      query: 'test',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    } as Response);

    render(<Search maxResults={10} />);
    const button = screen.getByRole('button', { name: 'Search' });

    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(input, { target: { value: 'test' } });
    });

    await waitFor(
      () => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/search.json',
          expect.objectContaining({
            body: JSON.stringify({ query: 'test', limit: 10 }),
          }),
        );
      },
      { timeout: 500 },
    );
  });
});
