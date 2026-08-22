# Production world loader

- Added a solid-white full-screen loader with an animated inline globe SVG.
- Hardcoded the building phase to exactly two seconds before showing `Press to continue`.
- The continue gesture primes the shared streamed-dialogue audio and starts the production experience; development bypasses the loader.
- Agent captions begin 500 ms after avatar first-frame readiness and the experience-start gate.
