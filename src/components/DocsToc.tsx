/**
 * Docs Table of Contents Component
 * Automatically generated from page headings
 */

import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function DocsToc() {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Extract headings from the page
    const article =
      document.querySelector('article') || document.querySelector('main');
    if (!article) return;

    const headings = article.querySelectorAll('h2, h3');
    const items: TocItem[] = Array.from(headings).map((heading) => ({
      id:
        heading.id ||
        heading.textContent?.toLowerCase().replace(/\s+/g, '-') ||
        '',
      text: heading.textContent || '',
      level: parseInt(heading.tagName.substring(1), 10),
    }));

    setToc(items);

    // Set up intersection observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66%' },
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL without jumping
      window.history.pushState(null, '', `#${id}`);
    }
  };

  if (toc.length === 0) {
    return null;
  }

  return (
    <aside className="fixed top-14 right-0 z-30 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-l border-toc-border bg-toc xl:block">
      <div className="py-6 px-6">
        <h4 className="mb-4 text-sm font-semibold text-toc-foreground">
          On this page
        </h4>
        <nav>
          <ul className="space-y-2.5">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`
                    block text-sm transition-colors
                    ${item.level === 3 ? 'pl-4' : ''}
                    ${
                      activeId === item.id
                        ? 'text-toc-foreground font-medium'
                        : 'text-toc-foreground/60 hover:text-toc-foreground'
                    }
                  `}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
