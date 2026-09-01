# Match blog navigation spacing

## Requested scope

Reduce the empty area between the blog's back link and article-grid divider, then make that lower gap match the page's top inset above the link.

## Work performed

Changed the blog-index navigation bottom margin from six rem to 1.5 rem, matching the blog page's 1.5-rem top padding. The same balanced spacing applies on narrow screens. Article pages retain their intentionally larger navigation-to-article separation.

## Changed files

- `src/styles/blog.css`
- `src/styles/INFO.md`
- `milestone/current.md`
- `milestone/history/info.md`

## Verification

- `npx eslint src/app/blog/page.tsx`
- `npx tsc --noEmit`
- `git diff --check`

All checks passed.
