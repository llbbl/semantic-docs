/**
 * Theme Switcher Component
 * Allows users to switch between different color themes
 */

import { useEffect, useState } from 'react';
import { defaultTheme, type Theme, themes } from '../config/themes';

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || defaultTheme;
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (themeName: string) => {
    const theme = themes.find((t) => t.name === themeName);
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    localStorage.setItem('theme', themeName);
  };

  const handleThemeChange = (themeName: string) => {
    setCurrentTheme(themeName);
    applyTheme(themeName);
    setIsOpen(false);
  };

  const currentThemeLabel =
    themes.find((t) => t.name === currentTheme)?.label || 'Theme';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3"
        aria-label="Switch theme"
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
        <span className="hidden md:inline">{currentThemeLabel}</span>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent border-0 p-0 cursor-default"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') {
                setIsOpen(false);
              }
            }}
            aria-label="Close theme menu"
          />
          <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover shadow-lg z-50">
            <div className="p-2">
              <div className="mb-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                Theme
              </div>
              {themes.map((theme) => (
                <button
                  type="button"
                  key={theme.name}
                  onClick={() => handleThemeChange(theme.name)}
                  className={`
                    w-full text-left px-3 py-2 text-sm rounded transition-colors
                    ${
                      currentTheme === theme.name
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-accent/50 text-foreground'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span>{theme.label}</span>
                    {currentTheme === theme.name && (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
