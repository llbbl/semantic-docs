import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Search from './Search';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders search results whose folders match inherited object properties', async () => {
  const folders = ['constructor', 'toString', '__proto__'];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: folders.map((folder, index) => ({
          id: index + 1,
          title: `Test ${folder}`,
          slug: folder,
          folder,
          tags: [],
          distance: 0.5,
          excerpt: '',
        })),
      }),
    }),
  );

  render(<Search />);
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  fireEvent.change(await screen.findByPlaceholderText('Search articles...'), {
    target: { value: 'test' },
  });

  for (const folder of folders) {
    const link = await screen.findByRole('link', { name: `Test ${folder}` });
    expect(link.getAttribute('href')).toBe(`/content/${folder}`);
    expect(screen.getByText(folder.toUpperCase())).toBeDefined();
    expect(
      screen.getByRole('option', { name: `Test ${folder}` }),
    ).toBeDefined();
  }
});
