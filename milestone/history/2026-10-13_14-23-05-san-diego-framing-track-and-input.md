# San Diego framing, track, and overview controls

- Acting role: primary agent; implemented and verified directly as requested.
- Scope: tighten the San Diego globe label, remove its loading caption, allow overview yaw without pitch, widen and shift the overview north, and add Mesa Verde's reference-based oval track. Geographic expansion was requested and then explicitly cancelled.
- Starting state: clean `dev` at `317a243`; San Diego overview zoom 0.65 at the origin, fixed drag behavior, wide detached label, and no Mesa Verde athletics field.
- Changes: globe label right alignment and edge anchoring; entry status cleared; unlocked overview added to azimuth-only drag routing; generator/manifest overview zoom 0.5 and target `[0, 0, -240]`; athletics lawn, cream oval, green infield, tree exclusion, and explicit authored-surface provenance; generated model/layout/manifest and corresponding folder guides updated. `main` checkout is untouched.
- Verification: targeted ESLint and `npx tsc --noEmit --incremental false`; controlled mouse/touch horizontal and vertical gestures, locked landmarks and mid-gesture lock checks; marker canvas and sprite alignment; Chromium overview/track/rotation review and loading-caption observer; decoded asset comparison (only terrain changed), finite geometry, unchanged bounds/source/counts/landmarks, model hash, and repeat generation. Model hash: `e533fcc311dd4d9f0c98f22817b4d661215d2b2ab5ddb5d7a396e9d4054bafa9`.
- Result: all requested changes implemented locally on `dev`; existing geographic boundaries retained. No build, commit, push, or deployment performed.
- Remaining work: user visual feedback, physical touch review, and replacement of placeholder stories. Continue rapid visual tweaks on this checkout.
