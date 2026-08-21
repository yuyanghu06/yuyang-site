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
