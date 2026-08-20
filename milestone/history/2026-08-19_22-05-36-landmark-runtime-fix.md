# Landmark runtime failure fix

- Fixed `createLandmarkDetails` crashing with `TypeError: placements is not iterable` for the two new Union Square West landmarks. Buildings without an explicit rooftop-equipment layout now skip only that optional detail branch while retaining facade windows.
- Added immediate rejection handling to destination-triggered, fire-and-forget neighborhood tile loads. Abort errors from React/HMR cleanup are absorbed; genuine failures remain logged.
- Confirmed the current generalized `createParkTrees` helper is defined and used for both Washington and Union/Gramercy greenery; earlier undefined-helper messages were intermediate hot-reload states rather than the final source.
- ESLint, TypeScript, and the optimized Next.js production build pass.
