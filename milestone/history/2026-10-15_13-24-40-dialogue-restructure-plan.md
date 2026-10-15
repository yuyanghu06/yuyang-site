# Dialogue folder restructuring plan

Role: planner; requested scope: organize dialogue by San Diego and New York, with individualized San Diego view folders.

Starting state: dev checkout with existing edits in next-env.d.ts and the San Diego overview, Park Village and Torrey Pines scripts.

Plan: retain global/; keep san-diego.md and tour-complete.md at the San Diego root; move seven camera scripts into same-name subfolders; create new-york/ with manhattan.md and the existing Union Square/Washington Square folders. Preserve every narration byte and export name. One coder owns dialogue/**; the orchestrator owns parent documentation and milestone files.

Evidence: planner found index.ts is the sole direct Markdown importer; consumers use its stable exports. Orchestrator saved SHA256s of all 20 scripts in /tmp/yuyang-dialogue-restructure-before.json. Acceptance requires exact hierarchy, byte preservation, resolving imports, accurate INFO.md inventories, scoped ESLint, no-incremental TypeScript and independent evaluation. Implementation is pending; no build or commit is requested.
