# Loading shell and background-work pause

- Moved the Three.js scene behind a small dynamic client shell so `NOW BUILDING` is present in the initial HTML and the heavy map chunk loads afterward.
- Replaced the fixed perimeter progress animation with an active pre-hydration state and renderer/road milestone progress.
- Preloaded the 421 KiB road GLB from the document head while preserving roads-ready as the loader exit gate.
- Removed the redundant 12-response center-tile warm-up, reduced decode batches to four, and yielded between batches.
- Paused new tile decode batches and route/landmark construction while the document is hidden; work resumes when visible.
- Confirmed ESLint, TypeScript, and the optimized Next.js production build pass. `/` remains statically prerendered.
