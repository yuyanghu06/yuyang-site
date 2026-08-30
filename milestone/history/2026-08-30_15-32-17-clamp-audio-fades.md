# Clamp audio fade frames

The shared `fadeAudioVolume` primitive now clamps normalized animation progress and every interpolated volume frame. This prevents exponential fade-out rounding from producing tiny negative values that violate the browser's `[0, 1]` `HTMLMediaElement.volume` range.

Targeted ESLint and TypeScript validation pass.
