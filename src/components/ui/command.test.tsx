import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';

it.each(['dialog', 'combobox'])(
  'provides an accessible search name for the %s',
  (role) => {
    render(
      <CommandDialog open>
        <CommandInput placeholder="Search articles..." />
        <CommandList />
      </CommandDialog>,
    );

    expect(screen.getByRole(role, { name: 'Search articles' })).toBeDefined();
  },
);

it('keeps semantic results visible in server order when the query differs from their titles', async () => {
  const rankedTitles = [
    'Certificate management',
    'Secure origins',
    'HTTPS overview',
  ];

  render(
    <CommandDialog open>
      <CommandInput placeholder="Search articles..." />
      <CommandList>
        <CommandGroup heading="Docs">
          {rankedTitles.map((title) => (
            <CommandItem key={title} value={title}>
              {title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>,
  );

  fireEvent.change(await screen.findByPlaceholderText('Search articles...'), {
    target: { value: 'https' },
  });

  await waitFor(() => {
    expect(
      screen.getAllByRole('option').map((item) => item.textContent),
    ).toEqual(rankedTitles);
  });
});
