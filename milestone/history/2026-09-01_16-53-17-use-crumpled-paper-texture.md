# Use crumpled-paper blog texture

## Requested scope

Replace fine procedural grain with the stronger folded and crumpled paper texture shown in the user's supplied reference image.

## Work performed

Copied the supplied PNG into `public/style-references/crumpled-paper-texture.png` and replaced the inline SVG turbulence layer with that runtime asset. The image is fixed, centered, and cover-scaled across the viewport, then blended over the existing ivory, amber, sage, and center-light background at 38% opacity with softened contrast and slightly raised brightness. Updated the style and public-reference folder guides.

## Changed files

- `public/style-references/crumpled-paper-texture.png`
- `public/style-references/info.md`
- `src/styles/blog.css`
- `src/styles/INFO.md`
- `milestone/current.md`
- `milestone/history/info.md`

## Verification

- `npx tsc --noEmit`
- `git diff --check`
- Confirmed `public/style-references/crumpled-paper-texture.png` exists and is non-empty.

All checks passed.

## Result

The blog background now has recognizable physical folds and creases rather than uniform digital noise, while preserving the established warm lighting beneath it.
