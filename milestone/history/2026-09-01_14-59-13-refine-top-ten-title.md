# Refine top-ten article title

## Requested scope

Remove the parenthetical joke from the first article's title and replace its existing caption with the joke as a subtitle.

## Work performed

Changed the title to “Top 10 NYU Students to Hire” and the article subtitle to “Hint: Yuyang Hu is all 10.” The same title now appears consistently in the blog index, article metadata, structured data, and related-post links because all of those surfaces share the central post registry.

## Changed files

- `src/app/blog/posts.ts`
- `milestone/current.md`
- `milestone/history/info.md`

## Verification

- `npx eslint src/app/blog/posts.ts`
- `npx tsc --noEmit`
- `git diff --check`

All checks passed.
