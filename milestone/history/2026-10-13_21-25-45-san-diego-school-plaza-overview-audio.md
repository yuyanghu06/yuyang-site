# San Diego school, Vons, and overview audio

Acting role: primary agent; implementation and verification performed locally as requested.

San Diego overview now replaces traffic with the supplied suburban-birds loop. Vons shares the Torrey Highlands Plaza camera and replaces the talking crowd with the supplied mall ambience. Westview, Mesa Verde, and Deer Canyon retain their verified student/crowd talking loop after camera settlement. Selected landmark IDs now reach the shared audio controller; New York audio routing is preserved.

Starting state: shared crowd audio already covered all San Diego landmark closeups, while traffic played across the city. The preceding completion-copy change and unrelated development work are preserved.

Files changed: `src/components/site-audio.ts`, `src/components/map/runtime/map-runtime.tsx`, their folder guides, `public/audio/INFO.md`, two new served audio files, and milestone documentation. The Downloads originals are untouched. Mall audio is attenuated 11.4 dB; birds audio is attenuated 20.2 dB and uses a rotated head/tail crossfade. Background music remains on its separate channel.

Targeted ESLint and full TypeScript without incremental output pass. An isolated controller harness verifies all three school states, overview/plaza transitions, settled-camera gating, fade endpoints, globe silence, effects mute, NYC regression, and complete disposal. Decoded mall peak is -18.00 dBFS versus crowd -18.14 dBFS; both use 0–0.216 runtime volume and 250 ms fades. Birds peak is -20.93 dBFS, matching traffic approximately -20.9 dBFS, with 1.2-second runtime entry/exit fades. Its authored 1.2-second head/tail crossfade produces a 301.176-second loop; decoded boundary sample change (0.00042955) is below nearby changes (maximum 0.00076013). No live browser listening review was performed.

No production build, commit, deployment, or remaining implementation blocker. User can review the sound levels in the running development preview.
