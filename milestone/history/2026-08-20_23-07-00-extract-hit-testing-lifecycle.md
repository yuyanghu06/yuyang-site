# Extract hit-testing and viewport lifecycle

- Moved all map ray construction and destination/landmark intersection tests into a typed interaction service.
- Moved intersection visibility, background-tab suspension, animation start/stop, and observer cleanup into a viewport lifecycle service.
- Reduced `map-runtime.tsx` from 1,090 to 1,029 physical lines and lowered the authored effective line cap to 1,050.
- Preserved unrelated avatar asset and milestone edits already present in the worktree.
- Verified with TypeScript and repository-wide ESLint.
