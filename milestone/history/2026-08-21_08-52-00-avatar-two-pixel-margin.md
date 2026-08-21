# Avatar two-pixel margin correction

The requested 2 px value applies to the expanded modal's outside viewport margin, not to the avatar crop. The mistaken 2 px avatar translation was removed. The vertically centered modal now uses `viewport height - 4px` when viewport-limited, producing equal 2 px top and bottom margins while preserving its width and 48rem height cap.

The user selected 12 px for the background blur. Stationary liquid glass now uses standard quality so the configured blur is not capped at 2 px, and the resize placeholder uses the same 12 px blur with 105% saturation.

Targeted ESLint, TypeScript, and diff-integrity checks pass.
