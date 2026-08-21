# Cohesive 2D face on the 3D avatar

Use this reference for the approved facial direction in `assets/blender/yuyang-avatar-2d-face-base.blend`.

## Invariants

- Keep the original Meshy cranium, ears, neck, hair, body, clothing, hands, shoes, and rig dimensional.
- Put all expressive facial artwork on the curved, Head-weighted `Yuyang_BlankFace_Canvas` and its `Face2D_UV` map.
- Treat eyes, eyelids, pupils, brows, nose marks, mouth, cheeks, and facial shading as one designed system. Do not paste isolated feature cards or restore the old sculpted face underneath.
- Preserve one neutral facial identity across every state. Expression changes should read as drawings of the same face, not swapped characters.

## Authoring sequence

1. Open the base file in the live Blender window and inspect the canvas at front, profile, and three-quarter angles.
2. Verify canvas fit, UV coverage, head weighting, z-fighting clearance, material alpha behavior, and visibility at the actual UI display size.
3. Create the approved neutral full-face artwork first.
4. Derive full-face state textures or atlas frames for blink and generic talking. Every state includes the complete coordinated face, even when only eyelids or mouth appear to change.
5. Add emotion states only after neutral/blink/talking pass their galleries.
6. Drive states with one material/atlas system or a controlled texture-state mechanism on the canvas. Avoid independently positioned eye, mouth, or brow objects.

## Review galleries

Build labeled clones on the same 3D head/canvas for:

- Neutral front, three-quarter, and profile.
- Blink at open, half, closed, half, and open.
- Talking closed, small-open, medium-open, wide, and rounded mouth states.
- Each emotion at neutral, midpoint, and maximum intensity when intensity is supported.

Show the gallery in the live Blender viewport at a readable face scale. Check UV distortion, canvas edge visibility, state-to-state alignment, and whether the complete face remains cohesive. Do not render a full animation until the relevant gallery is accepted.

## Runtime and export

- Keep the canvas separate from map landmark interaction bounds and raycasting.
- Ensure the face material and texture-state data survive GLB export.
- Use deterministic state names and keep runtime selection constrained; the model should request semantic emotions, not texture filenames.
- Begin and end loop/one-shot sequences on the exact same neutral full-face state and canonical body pose.

## Reset rule

If a state direction is rejected, remove only its texture/state data and gallery clones. Restore the verified base canvas instead of accumulating hidden facial cards or obsolete expression geometry.
