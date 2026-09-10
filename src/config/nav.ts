/**
 * Sidebar navigation order — the one file to edit when resequencing folders.
 * Consumed by the sidebar and by the prev/next links on article pages.
 */

/**
 * Folder directory names, in the order they should appear. A folder left out
 * of this list still renders; it sorts after every listed folder, alphabetically.
 * `root` is the folder for articles at the top level of ./content.
 */
export const folderOrder: readonly string[] = [
  'getting-started',
  'features',
  'theme',
];
