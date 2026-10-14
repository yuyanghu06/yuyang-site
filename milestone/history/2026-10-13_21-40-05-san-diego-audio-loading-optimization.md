# San Diego audio loading optimization

Role: orchestrator recording scoped coder pass.

SD-only mall and birds no longer receive sources at global startup. `site-audio.ts` exposes idempotent synchronous `prepareSanDiego()` to assign/preload once without playing or blocking scene navigation. The runtime calls it before the lazy destination import. Standalone SD updates prepare defensively; disposal prevents later preparation/playback. Existing routing, camera settlement, levels, fades, and effects mute are preserved.

Changed: `src/components/site-audio.ts`, runtime integration hook and `src/components/info.md`. No audio assets changed.

Coder verification: targeted ESLint, full no-incremental TypeScript, whitespace, and isolated Audio harness pass. The harness checks no SD sources before preparation, exactly-once preparation, no preparation playback, all school/plaza/overview states, NYC, fades, mute, and disposal. Defers 5,338,866 audio bytes until SD is requested. Independent evaluator review is in progress. Geometry batching and runtime optimization are not final; measured GPU submission overhead is being evaluated with a multi-draw prototype.
