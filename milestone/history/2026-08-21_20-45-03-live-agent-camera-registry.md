# Live agent camera registry

## Camera views

- Added one shared registry containing the four geographic cameras and six authored landmark cameras.
- The OpenAI navigation enum, parser validation, prompt-visible labels, runtime landmark association, camera framing, current-view reporting, and cross-neighborhood navigation now derive from that registry.
- Landmark agent commands route through Manhattan and the owning neighborhood as needed, then select immediately when the registered landmark becomes available after loading.
- Interactive landmark registration now fails explicitly when no camera-view record exists, preventing silent drift between manual and agent navigation lists.

## Interface color

- Matched the inline reply send arrow to the affirmative `Yes` button's layered blue fill while preserving its disabled opacity.

## Verification

- Targeted ESLint passes across the registry, agent tool loop, navigation model, runtime, and chat component.
- `npx tsc --noEmit` passes.
- `git diff --check` passes.
