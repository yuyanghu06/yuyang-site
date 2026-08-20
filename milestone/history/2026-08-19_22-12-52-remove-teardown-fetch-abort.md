# Remove teardown fetch abort

- The browser continued reporting an unhandled `AbortError` from `abortController.abort()` after immediate handling was added to the deferred neighborhood promise.
- Removed teardown-time shared-signal cancellation. Existing `disposed` checks prevent all late network/decode results from mounting into the destroyed scene, while in-flight requests can settle without browser-owned response promises rejecting outside the application chain.
- Verification: TypeScript, ESLint, and the optimized production build pass.
