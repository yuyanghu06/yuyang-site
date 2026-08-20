# Load stage timing instrumentation

- Added a reusable paired-stage facility to the structured client load logger.
- The initial four-city-tile batch now logs at its true start and end, including requested/loaded tile counts and stage-only duration.
- Deferred pedestrian, traffic, and park-path construction now logs at its true start and end, including roadbed/path counts and stage-only duration.
- Retained `elapsedMs` as total time since scene startup so logs expose both queue position and actual stage cost.
- Verified with ESLint (`--max-warnings=0`) and `git diff --check`.
