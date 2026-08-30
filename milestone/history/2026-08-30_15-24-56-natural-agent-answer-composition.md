# Natural agent answer composition

- Removed the 120-character writing rule from the site-agent prompt because the renderer already owns caption segmentation.
- Added explicit answer-composition rules requiring one coherent point, only relevant supporting details, natural transitions, and a small amount of reflection.
- Broad introductions now connect two or three themes rather than inventorying every known fact.
- Height, music, family, titles, dates, metrics, clients, and full technology stacks stay out unless directly relevant or requested.
- Preserved automatic 120-character renderer segmentation and manual overflow Next controls.
- Targeted ESLint, full TypeScript, and whitespace validation pass.
