# Blog

This folder owns the public, crawlable article index and the single source of truth for Yuyang Hu's casual SEO articles. Every post is rendered for both people and search engines; do not add crawler-only or visually hidden keyword content.

## Direct subfolders

- `[slug]/` renders one statically generated article page for each slug in `posts.ts`.

## Direct files

- `INFO.md` documents this folder.
- `page.tsx` renders the article index directly after its compact back navigation, without a large introductory hero, and supplies its route metadata.
- `posts.ts` contains the ten typed article records, summaries, publication dates, and body sections used by the index, article routes, and sitemap.
