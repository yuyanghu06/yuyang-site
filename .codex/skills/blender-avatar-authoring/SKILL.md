---
name: blender-avatar-authoring
description: Author, repair, animate, or review this repository's Yuyang avatar in the live Blender window, especially facial topology, mouth/eye controls, expression rigs, pose galleries, and animation clips. Use for work on assets/blender/yuyang-avatar.blend; do not use for map buildings or unrelated Blender assets.
---

# Blender Avatar Authoring

Use this project skill together with the installed `blender-animation-rigging` skill when it is available. That skill supplies Blender 5.x rigging and animation API patterns; this skill supplies the project-specific authoring and review contract.

Read `milestone/current.md` before acting. Its current avatar direction overrides historical experiments and examples in this skill.

## Live Blender contract

- If the user says to work in the open Blender window, use the Blender MCP connection. Do not substitute a headless Blender process.
- Inspect with `get_scene_info` before mutation. Confirm that `assets/blender/yuyang-avatar.blend` is open; the default Cube scene is not the avatar file.
- Use the sequence inspect -> small mutation -> viewport screenshot -> user-visible review. Keep each mutation localized and reversible.
- Reset the viewport to a front-facing material-preview or rendered camera view before asking the user to inspect. Hide armature overlays unless the rig itself is under review.
- Do not save the `.blend` after a structural facial edit until its close-up review gate passes, unless the user explicitly requests an intermediate save.

## Choose the active facial system

The currently approved direction is a cohesive 2D illustrated face on the curved 3D `Yuyang_BlankFace_Canvas` in `assets/blender/yuyang-avatar-2d-face-base.blend`. Read [references/2d-face-authoring.md](references/2d-face-authoring.md) for neutral, blink, talking, and expression work. Do not restore topology-driven 3D facial animation unless the user explicitly reopens that direction.

Use the topology workflow below only when the milestone or user explicitly selects a 3D facial-topology approach.

## 3D facial topology gate

Read [references/facial-authoring.md](references/facial-authoring.md) before creating or changing the mouth, eyelids, eyes, brows, cheeks, jaw, teeth, tongue, or expression shapes.

The selected source mesh is editable, but generated topology may not contain animation-ready concentric lip or eyelid loops. Inspect topology before deciding whether to retopologize or regenerate the source.

- A mouth-open control must separate and deform the avatar's actual upper/lower lip boundary and reveal a recessed oral cavity.
- Never fake the result with a flat animated oval, a surface card, or a detached lip ring placed in front of the face.
- Separate teeth, gums, and tongue are valid internal anatomy only after the actual lip opening works.
- Blinks must be made from genuine eyelid topology or fitted deformable eyelid geometry. Do not cover the eyes with flat skin-colored discs.
- If the source lacks sufficient topology, stop after showing the topology diagnosis. Offer controlled retopology or a new Meshy source explicitly generated for facial animation; do not hide the limitation with an overlay.

## Range-of-motion galleries

Every new facial control requires a live inspection gallery before animation:

- Clone neutral, useful intermediate states, and the maximum safe state.
- For symmetric controls, include both symmetric and independent left/right states when relevant.
- Label clones with the control and value, for example `jawOpen 0`, `jawOpen .5`, and `jawOpen 1`.
- Arrange clones front-facing at a readable face scale. Verify the actual viewport composition with a screenshot.
- Keep the gallery separate from the working rig so gallery meshes cannot be mistaken for production geometry.

For a full facial rig, review at least jaw open, mouth close, smile, frown, wide, pucker, upper/lower lip raise, left/right sneer, blink left/right/both, squint, brow inner/outer up/down, cheek raise, and eye look directions. Add only controls supported by the topology.

Do not render a full animation clip until the relevant control galleries have been accepted. A five-second talking clip must also begin and end in numerically identical neutral poses.

## Backups and cleanup

- Before topology changes, create a recoverable versioned `.blend` backup on disk. An in-scene duplicate alone is not a sufficient topology backup.
- Name experimental collections clearly and keep them isolated from the working avatar.
- When the user rejects a direction, remove its experimental objects, actions, materials, and galleries, then restore from the verified disk backup.
- Never report a reset as complete until object counts, shape keys, and visible viewport state confirm the original avatar is restored.

## Project records

After an accepted or rejected meaningful authoring pass, update `milestone/current.md` and add a timestamped handoff under `milestone/history/`. Record what was approved or rejected and which asset is authoritative. Do not describe an unreviewed candidate as approved.
