# Avatar skin material response

- Identified the washed-out skin cause in the GLB: the same color texture was exported as a full-strength emissive texture, alongside a 2× specular color response.
- Reduced runtime emissive intensity to `0.08` and physical-material specular intensity to `0.35`.
- This lets the deeper peach base texture respond to the golden camera light instead of appearing self-lit white.
- Targeted ESLint and diff validation passed; no production build was run during this visual iteration.
