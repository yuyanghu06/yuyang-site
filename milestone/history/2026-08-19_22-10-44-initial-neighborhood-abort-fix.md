# Initial neighborhood abort fix

- Traced the cleanup-time `AbortError` to the initial `loadNeighborhood` promise, which could reject before its later deferred `await` attached a handler.
- Added immediate rejection handling: expected aborts resolve quietly, while real failures are retained and thrown through the existing scene-load error path once awaited.
- Verification: TypeScript, ESLint, and the optimized production build pass.
