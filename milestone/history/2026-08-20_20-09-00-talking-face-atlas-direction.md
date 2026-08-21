# Talking face atlas direction

- Defined the first talking animation as 2D face-state animation only: neutral eyes, half/full blink, and several talking mouth shapes based on the approved illustrated template.
- Chose a true-alpha sprite atlas sampled in the optimized head's existing material instead of a GIF, video, or separate overlay mesh. This keeps website lighting fully live and makes timing deterministic.
- The intended shader composites `baseColor` with the selected face tile inside the existing facial UV region; the complete face drawing changes as one aligned unit.
- Generated an eight-state layout exploration and saved it as `public/style-references/avatar/yuyang-avatar-face-talking-atlas-draft.png`.
- Validation found that the generated file has no alpha channel and contains a baked checkerboard. It is non-authoritative layout reference only and must not be wired into the model or website.
- Next: create deterministic aligned artwork from the approved concept, export genuine alpha, map the facial UV island, and test neutral/blink/talking frame switching.
