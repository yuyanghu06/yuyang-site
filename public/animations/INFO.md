# Runtime animations

This folder is the permanent public home for exported animation GLBs. All current and future standalone avatar animation clips must live here rather than in `public/models/`.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `idle.glb` is the approved live five-second idle animation. It uses the user's manually tuned symmetric open-hand arm placement, holds the hips and complete leg/foot/toe chains numerically fixed, and embeds the illustrated face as a separate 442-vertex mesh skinned exactly 100% to `Head`. The face uses the user's final approved manual transform: location `(-0.000442441, -0.065205455, 0.336710483)`, XYZ Euler rotation `(0.280676663, -0.085589372, 0.202968687)`, and scale `(1.164230943, 1.164231062, 1.164230943)`. Location, rotation, and scale are fully locked, and the exported loop closes at exactly `0.0` pose-matrix delta.
- `wave-hello-review-v1.glb` is an unapproved four-second wave candidate derived from `idle.glb`. Its V6 pose turns the palm outward and keeps the elbow below the shoulder, avoiding the shirt topology's severe high-arm underarm stretch while retaining the original 52-bone skin and single connected body mesh. The lower body stays on the idle base, and its first/last complete pose matrices match exactly.
- `wave-hello-review-v2.glb` is the 2.5-second open-hand wave source used for the site's first-load introduction. It preserves the restrained upper-arm movement, elbow-carried raised hand, planted lower body, embedded Head-skinned face, and one `wave_hello` Action. Runtime normalization locks its body, neck, head, translations, and scales to the idle opening pose and replaces its arm bookends with the exact idle values before playback. Its editable conversion is `/tmp/yuyang-wave-hello-review.blend`.
- `INFO.md` is this authoritative folder inventory and animation-location policy.
