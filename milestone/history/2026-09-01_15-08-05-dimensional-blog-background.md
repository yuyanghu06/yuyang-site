# Dimensional blog background

## Requested scope

Replace the blog's flat-feeling surface with the proposed warm paper treatment using layered light and subtle texture.

## Work performed

Replaced the prior single sage glow and vertical gradient with a warm ivory base, upper-left amber illumination, lower-right sage illumination, and a broad soft white center light. Added a fixed, pointer-transparent SVG turbulence layer at 3.5% opacity to create restrained paper grain without adding a separate asset or affecting article interaction.

## Changed files

- `src/styles/blog.css`
- `src/styles/INFO.md`
- `milestone/current.md`
- `milestone/history/info.md`

## Verification

- `npx tsc --noEmit`
- `git diff --check`
- Live browser reload and computed-style inspection confirmed all three gradients and the 0.035-opacity grain layer.
- Live browser screenshot confirmed the lighting and texture render behind the unchanged article grid.

All checks passed.

## Result

Both the index and individual articles retain the quiet editorial palette but now have gentle depth and paper character instead of a flat digital fill.
