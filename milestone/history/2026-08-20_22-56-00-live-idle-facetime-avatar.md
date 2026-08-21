# Live idle avatar in FaceTime shell

- Replaced the static FaceTime portrait placeholder with a browser-only Three.js avatar view loading `public/models/yuyang-avatar-idle-loop-v2.glb`.
- Added the approved closed-mouth smiling atlas tile on one curved canvas attached to the animated `Head` bone, plus a soft studio/drop shadow.
- Corrected the initial Blender Z-up versus glTF Y-up mismatch that rendered the body lying toward the camera and detached the face.
- Added a dedicated waist-up docked-card framing instead of leaving the minimized card blank.
- Fixed reopen pixelation by forcing renderer resizing after the 460 ms dock-to-modal transform completes.
- Grounded the avatar against the lowest foot/toe bone, filtered all leg animation tracks and hip rotation, and retained upper-body idle motion so the feet remain planted rather than swaying.
- Targeted ESLint and TypeScript checks pass; no full production build was run during iteration.
