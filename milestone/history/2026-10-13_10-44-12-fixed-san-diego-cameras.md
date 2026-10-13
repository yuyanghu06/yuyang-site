# Fixed San Diego cameras restored

User requested fixed cameras like New York. Disabled `SAN_DIEGO_FREE_CAMERA_ENABLED` and restricted legacy drag rotation to unlocked Washington/Union views. San Diego overview and both landmark views therefore stay fixed, and the temporary Reset/Copy panel is hidden. Guided wheel/pinch, selection, tour transitions, Escape, and responsive landmark fitting remain active. Palette, model, source data, and authored camera presets are unchanged.

Validation: targeted ESLint, full TypeScript, independent controlled input checks (12 SD drag combinations plus guided navigation and NYC/globe behavior), matching asset/preset hashes, and whitespace checks pass. Live browser observation confirmed the authoring panel disappeared after HMR; the remaining SD drag smoke check was not completed because the user changed Chrome during review. No full build, commit, or deployment.

Next: keep authored camera views and replace placeholder stories when supplied. Disabled authoring helpers remain available behind the flag for later adjustment work.
