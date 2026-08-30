# Project Agent Instructions

## Session startup

- At the start of every new session, read `milestone/current.md` if it exists before beginning work.
- Use timestamped files in `milestone/history/` when historical context is needed; do not read the entire history by default.

## Folder documentation

- Every folder in the repository must contain an `INFO.md` file written in clear, readable English.
- Each `INFO.md` must explain the folder's purpose, list and describe every direct subfolder, and list and describe every direct file in that folder.
- Whenever a file is added, removed, renamed, or updated, update the `INFO.md` in its containing folder as part of the same change. Whenever a direct subfolder is added, removed, renamed, or repurposed, update the parent folder's `INFO.md` as part of the same change.
- Keep each `INFO.md` accurate as the authoritative local guide to its folder; do not defer documentation updates to a later change.

## Milestone maintenance

- After meaningful project work, update `milestone/current.md` with the authoritative project state, decisions, blockers, and next steps.
- After meaningful project work, also create a concise session handoff in `milestone/history/` using the filename format `YYYY-MM-DD_HH-MM-SS-short-description.md`.
- Treat files in `milestone/history/` as append-only records. Do not revise an existing history file to reflect later work.
- Do not create a history entry for a session that made no meaningful project change.

## Verification cadence

- Do not run a full production build after every incremental change.
- During iteration, use only the targeted checks needed for the files or behavior being changed.
- Run the full production build before creating a commit, or earlier only when the user requests it or the change specifically requires build-level verification.

## RAG memory authoring and ingestion

- Pinecone is the only deployed memory store. Do not add a checked-in local memory database, source snapshot, or generated corpus. Temporary exports and corpora belong under `/tmp/yuyang-pinecone-memory/` and must be removed after successful ingestion.
- Treat the canonical Google Doc as the source of truth. Add, revise, or remove knowledge there first, then export its paragraph structure to `/tmp/yuyang-pinecone-memory/memory-source.json`. Never patch, append, or delete Pinecone records independently of the Google Doc; Pinecone is a replaceable derived index, not an authoring surface. The export must contain `documentId`, `documentUrl`, `revisionId`, and a `paragraphs` array whose entries contain `style` and `text`.
- Structure source records with Heading 2 for the retrieval domain, Heading 3 for one canonical entity or record, and optional Heading 4 subsections for distinct topics within that record. Keep facts about the same entity together; create a new Heading 3 when the entity or independently retrievable subject changes.
- At the start of a Heading 3 record, use these optional metadata lines when applicable: `Entity type:`, `Entity ID:`, `Aliases:`, and `Record status:`. Use a stable lowercase `Entity ID` such as `person:amaan-arif`, `organization:shift`, or `project:shift-checkout`; never reuse one ID for different entities. Include alternate names and abbreviations in `Aliases`.
- Write chunks as self-contained factual prose. Resolve pronouns, name the relevant person/organization/project, include dates and relationship context needed to understand the passage alone, and avoid chatbot instructions or preferences that are not facts useful for conversing with Yuyang.
- Do not hand-split ordinary records. `npm run memory:build` preserves Heading 3/Heading 4 boundaries, packs paragraphs to 190 words, uses 28-word overlap only for long text, and adds a contextual domain/record/entity prefix. Stable vector IDs are derived from document ID, entity ID, subsection, and chunk index.
- Every generated chunk must retain the retrieval metadata contract used by `src/agent/memory/retrieval.ts`: `text`, `source`, `domain`, `record`, `entityId`, `entityType`, `aliases`, `searchTerms`, `status`, `section`, `chunkIndex`, `chunkCount`, and `sourceRevisionId`. Embeddings must use `text-embedding-3-small` against a 1536-dimension index.
- Build with `npm run memory:build -- --source /tmp/yuyang-pinecone-memory/memory-source.json --output /tmp/yuyang-pinecone-memory/memory-corpus.json`. Inspect record/chunk counts, stable IDs, contextual prefixes, metadata, and representative chunks before any write.
- Ingestion is intentionally replacement-only, not an incremental append. Run it only with the exact destructive confirmations: `npm run memory:ingest -- --corpus /tmp/yuyang-pinecone-memory/memory-corpus.json --reset --confirm-index "$PINECONE_INDEX" --confirm-namespace "${PINECONE_NAMESPACE:-__default__}"`. Resolve and verify the concrete index and namespace before execution; never guess a destructive target.
- After ingestion, require the Pinecone namespace count to equal the generated chunk count, then test at least: an exact-name/entity query, a semantic paraphrase, a multi-turn follow-up, a base-fact query that must bypass RAG, and an unsupported question that must return uncertainty. Confirm that answers expose no citations, metadata, record IDs, or retrieval implementation details.

## Landmark geometry integrity

- Whenever procedural or higher-LOD geometry (such as windows, facade panels, rooftop equipment, trim, or signs) is added to a base dataset building, bake or merge the additions with the base geometry into one selectable object before exposing it to outlines, raycasting, hover, click, lift, or camera interactions.
- Do not keep interactive landmark details as independently transformable scene objects. Selection bounds, outlines, animation, and loading must always operate on the merged base-plus-detail object so visual layers cannot separate.

## Authoritative avatar rig

- The only active avatar Blender source is `assets/blender/yuyang-avatar-talking-loop-face-v2.blend`. Its 54-bone V2 skeleton retains the corrected talking body/hand Action and the approved animated 2D face canvas. Earlier avatar `.blend`/`.blend1` sources are recovery-only under ignored `data/raw/avatar-blender-archive-2026-08-20/`; do not restore them to `assets/blender/` unless the user explicitly reopens that work.
- Use this 54-bone rig for all new avatar work. It contains the complete 24-bone Meshy humanoid body skeleton plus three connected deform joints for every thumb, index, middle, ring, and pinky on both hands.
- The original generated hand topology and blank-face v2 body are preserved in this rig. The face remains intentionally featureless until the approved cohesive 2D facial atlas is bound through the head's actual UV/material path.
- Do not resume work from the older static, A-pose, arms-down-static, unrigged blank-face, rejected procedural-hand, or rejected Quaternius hand-motion test assets.
- The hand hierarchy now matches the library template's three-joint-per-digit structure, while preserving the original hand silhouette in the neutral pose. Gesture deformation still requires visual approval before production use.
- The retained Actions are `Yuyang_Idle_Loop_v2`, a 2.5-second exact loop retargeted from `Idle_Loop`, and `Yuyang_Talking_Loop_v2`, a 2.933-second exact loop retargeted from `Idle_Talking_Loop`. The idle keeps the V2 digit chains neutral. The talking loop maps both complete shoulder-to-hand chains and all 30 finger bones with restrained per-chain motion scaling; do not revert it to upper-arm-only retargeting.
- `assets/blender/yuyang-avatar-talking-loop-face-v2.blend` is the combined talking-body/approved-2D-face review source. Its head-weighted curved `Yuyang_BlankFace_Canvas` samples the cheek-free eight-state atlas and keys two blink arcs plus restrained talking-mouth holds. The authoritative review is a straight-on 1080x1440 render at `public/style-references/avatar/yuyang-avatar-talking-loop-face-v2.mp4`; material-state animation still needs a runtime WebGL implementation before this facial animation can be treated as a self-playing GLB.
- The FaceTime shell's browser-only avatar renderer lives under `src/components/avatar-view/`. It loads `public/animations/idle.glb`, whose manually fitted neutral face is embedded as a transform-locked mesh weighted 100% to `Head`; do not recreate that face with a separate runtime canvas. Future faces must be positioned and visually approved manually, then frozen at that exact transform and exported with the armature. Every animation that should keep the avatar planted must remove root, hip, and leg motion while retaining the neck/head and complete arm, hand, and finger chains; the approved idle already bakes that policy into its five-second `Idle_Loop`.
- The reusable animation-library source, accepted retarget checkpoint, skeleton matching rules, rejected mapping approaches, and mandatory GLB/X-ray validation gates are authoritative in `docs/avatar-animation-system.md`. Read that document before any avatar retargeting. Preserve `public/animations/idle.glb` as the current mapping checkpoint and make only isolated, review-named derivatives. Store all future standalone exported animation GLBs in `public/animations/`, not `public/models/`. Structural mapping changes must remain clip-independent; animation-specific tuning may only add small documented offsets/scales after the mapping passes.

## Authoritative globe source

- The only active globe Blender source is `assets/blender/lowpoly-earth-watercolor.blend`. Its automatic `.blend1` backup and the obsolete yellow-facet preview pair are recovery-only under ignored `data/raw/globe-blender-archive-2026-08-20/`.

## Figma workflow

- The project uses the Figma MCP server for design work.
- When the user provides a Figma project, place all generated style-reference images in that Figma file.
- Organize each distinct website page or concept area on its own Figma page.
- For generated reference sets, use a clearly named Figma page and preserve useful variant names or captions.
- Do not leave generated style references only in local or temporary storage once a target Figma file has been provided.
- If the supplied Figma URL does not contain a real file key or the MCP account lacks access, ask the user for a shareable `/design/<file-key>/...` URL or access before proceeding.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
