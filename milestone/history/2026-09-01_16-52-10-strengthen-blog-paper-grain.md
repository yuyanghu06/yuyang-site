# Strengthen blog paper grain

## Requested scope

Increase the blog background grain so the surface reads more clearly as paper.

## Work performed

Raised the fixed SVG turbulence layer opacity from 3.5% to 7.5%, slightly more than doubling its visible strength while leaving the underlying ivory, amber, sage, and center-light composition unchanged. Updated the style folder guide to describe the more apparent paper texture.

## Changed files

- `src/styles/blog.css`
- `src/styles/INFO.md`
- `milestone/current.md`
- `milestone/history/info.md`

## Verification

- `npx tsc --noEmit`
- `git diff --check`

Both checks passed. A live-browser refresh was attempted, but the browser-control connection could not be re-established in this pass, so no new automated screenshot was captured.

## Result

All blog routes now render the same paper grain at 7.5% layer opacity, making the texture substantially easier to perceive without changing content layout.
