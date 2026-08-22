# VRM animation library pull and rejected direct test

- Cloned `norio/vrm-game-starter` as a separate sibling repository at commit `b14c236fd8150855348ad085b7820c298eac4b30`.
- Copied its byte-identical 46-clip Quaternius-derived `AnimationLibrary.glb` into `public/models/quaternius-vrm-animation-library.glb` and recorded the separate asset-license boundary.
- Confirmed the library includes a complete `A_TPose`, `Idle_Loop`, and 44 additional named clips across 53 animated joints.
- Rejected a direct world-space/name-mapped runtime experiment after visual review showed both arms driven overhead.
- Removed the experimental retargeter and restored the site's prior embedded idle loader; targeted ESLint and full TypeScript checks pass.
- Next step: convert the avatar to a normalized VRM humanoid before using the starter's retargeting implementation unchanged.
