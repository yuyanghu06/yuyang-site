# Symmetric city memory and mobile optimization plan

Role: orchestrator recording planner pass and scope expansion.

User requests additional RAM and mobile optimization, then asks for the reverse city direction too. Preserve all geometry/population/cameras. Both cities should remain unprepared until requested; use mobile rendering bounds for both city views. SD is already lazy. NYC currently eagerly prepares405 tiles with43,231,722 decoded buffer-view bytes plus roads10,857,868 bytes,4,440,109-byte runtime JSON and other geometry. This is an asset/buffer budget, not a total process-RAM estimate. Avoid speculative GLB buffer deletion; interactive CPU data is required.

Ownership: city_memory handles lazy NYC lifecycle/readiness and runtime profile integration; city_mobile_renderer handles shared pure profiles/rendering/adaptive APIs; sd_audio_loading handles source-free NYC traffic and symmetric city audio. Root owns integration/docs. Target mobile DPR1–1.5, desktop current quality, SDshadow1024/mobile2048/desktop, existingNYCshadow1024. Verify no opposite city requests, first-entry readiness/veil, cached reuse, direct landmarks/history/rapid switches/failure/teardown, quality bounds/resize/orientation, controlled rendering and desktop/phone visuals, lint/TypeScript/finalbuild, independent review.

A concurrent workspace operation switched dev to main and began a merge. Working-file documentation conflicts are reconciled by preserving both histories and current workspace facts; audio worker retains both music-mute and SD behavior. No branch switch, merge commit or unrelated reset was performed by this pass. Merge index resolution is recorded separately in final verification. Existing user/agent changes remain preserved.
