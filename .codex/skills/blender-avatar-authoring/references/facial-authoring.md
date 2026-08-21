# Facial authoring workflow

Read this reference before facial geometry or facial-control work.

## Diagnose before modeling

1. Inspect the live file, active object, modifiers, armature, shape keys, materials, and actions.
2. Capture a front close-up and a wireframe/topology close-up of the mouth and eyes.
3. Confirm whether the mouth has separate upper/lower vermilion borders and concentric supporting loops, and whether the eyelids have loops that can close over the eyeballs.
4. Test existing shape keys at value `0` and `1`. Verify which vertices move; names are not evidence. A prior key named `Mouth_Open` moved nose vertices.
5. Choose controlled retopology, or regenerate a facial-animation-ready source in Meshy when identity drift is acceptable and the output can require a mouth cavity, lip loops, eyelids, teeth, tongue, and blendshape-ready topology.

## Retopology requirements

- Preserve an untouched versioned source file before editing.
- Build continuous lip loops with supporting loops around the mouth corners and nasolabial area.
- Extrude the mouth boundary inward into connected cavity walls; the opening must not expose the exterior shell or clothing.
- Add teeth, gums, and tongue behind the lip plane with adequate clearance through the full jaw range.
- Build upper and lower eyelid loops that follow the eyeball surface and meet without intersecting during a blink.
- Provide enough cheek, brow, and nasal support loops for smiles, frowns, sneers, squints, and brow compression without collapsing large triangles.
- Use localized weights and inspect deformation from front, profile, and three-quarter views.

## Review gates

- Closed mouth is visually unchanged from the approved neutral.
- Maximum mouth opening is rounded and connected, with no detached rings, holes into the neck, or lip tearing.
- Teeth and tongue remain behind the lips and never float outside the face.
- Full blink covers the eye naturally and reopens without a seam or forehead patch.

Generate labeled pose galleries only after topology passes. For each control, inspect neutral, midpoint, and maximum from front and three-quarter views. Reject a control when it only changes silhouette through an overlay, moves the wrong region, intersects anatomy, or loses the avatar's identity.

## Animation gate

- Author restrained combinations rather than driving every control to maximum.
- Use irregular blinks and subtle eye-focus changes so the stare does not read as dead.
- Keep feet/root stable for the talking clip unless the user approves body motion.
- Verify the first and final armature transforms and shape values numerically; also compare rendered bookend pixels when lighting is deterministic.
- Render a close facial test before a full-resolution five-second review clip.

## Known rejected approaches

- Flat oval mouth geometry animated in front of closed lips.
- Detached upper/lower lip tubes surrounding a cut hole.
- Skin-colored discs placed over the eyes as fake eyelids.
- Full video renders before close-up mouth and blink tests.
- Assuming a shape key affects the correct anatomy based on its name.
